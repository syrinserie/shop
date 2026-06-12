const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

router.post('/confirm', (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.status(401).render('login_required', {
            message: '결제를 하기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const cartQuery = `
        SELECT c.product_id, c.quantity AS order_quantity, p.price, p.quantity AS stock_quantity, p.name AS product_name
        FROM cart_items c
                 JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
    `;

    db.all(cartQuery, [user.id], (err, cartItems) => {
        if (err) return res.status(500).send('DB 오류: 장바구니 내역 조회 실패');

        if (!cartItems || cartItems.length === 0) {
            return res.render('order_confirm', {
                user,
                error: '장바구니가 비어 있어 주문할 수 없습니다.',
            });
        }

        let stockError = null;
        let totalPrice = 0;

        for (const item of cartItems) {
            totalPrice += item.price * item.order_quantity;

            if (item.order_quantity > item.stock_quantity) {
                stockError = `재고 부족: [${item.product_name}] 상품의 남은 수량이 부족합니다. (현재 재고: ${item.stock_quantity}개 / 요청 수량: ${item.order_quantity}개)`;
                break;
            }
        }

        if (stockError) {
            return res.render('order_confirm', {
                user,
                error: stockError
            });
        }

        db.get('SELECT cash FROM users WHERE id = ?', [user.id], (errUser, currentUser) => {
            if (errUser) return res.status(500).send('DB 오류: 회원 정보 조회 실패');

            if (currentUser.cash < totalPrice) {
                return res.render('order_confirm', {
                    user,
                    error: `보유 금액이 부족합니다. (필요 금액: ₩${totalPrice.toLocaleString()} / 보유 금액: ₩${currentUser.cash.toLocaleString()})`
                });
            }

            const insertOrderQuery = `INSERT INTO orders (user_id, total_price) VALUES (?, ?)`;

            db.run(insertOrderQuery, [user.id, totalPrice], function(errOrder) {
                if (errOrder) return res.status(500).send('DB 오류: 주문서 생성 실패');

                const orderId = this.lastID; // 💡 새 주문 아이디 확보
                let completedInserts = 0;
                let hasError = false;

                //장바구니 품목들을 하나씩 이식하며 재고 차감
                cartItems.forEach(item => {
                    db.run('INSERT INTO order_items (order_id, product_id, quantity, order_price) VALUES (?, ?, ?, ?)',
                        [orderId, item.product_id, item.order_quantity, item.price], (errItem) => {
                            if (errItem && !hasError) {
                                hasError = true;
                                return res.status(500).send('DB 오류: 주문 상세 내역 기록 실패');
                            }

                            //상품 테이블 실시간 재고 차감
                            db.run('UPDATE products SET quantity = quantity - ? WHERE id = ?', [item.order_quantity, item.product_id], (errStockUpdate) => {
                                if (errStockUpdate && !hasError) {
                                    hasError = true;
                                    return res.status(500).send('DB 오류: 상품 재고 수량 갱신 실패');
                                }

                                completedInserts++;

                                //모든 아이템 처리가 성공적으로 완료되었다면 정산 및 청소
                                if (completedInserts === cartItems.length && !hasError) {
                                    const newCash = currentUser.cash - totalPrice;

                                    db.run('UPDATE users SET cash = ? WHERE id = ?', [newCash, user.id], (errCashUpdate) => {
                                        if (errCashUpdate) return res.status(500).send('DB 오류: 보유 금액 차감 실패');

                                        //세션 잔액 동기화
                                        req.session.user.cash = newCash;

                                        //장바구니 비우기
                                        db.run('DELETE FROM cart_items WHERE user_id = ?', [user.id], (errCartClean) => {
                                            if (errCartClean) return res.status(500).send('DB 오류: 결제 후 장바구니 초기화 실패');

                                            //주문내역 리다이렉트
                                            res.redirect('../mypage/orderlist');
                                        });
                                    });
                                }
                            });
                        }
                    );
                });
            });
        });
    });
});

module.exports = router;