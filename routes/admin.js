const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

//운영자만 접근 가능
router.use((req, res, next) => {
        if (req.session.user && req.session.user.isAdmin === 1) {
            next();
        } else {
            const error = new Error("접근 권한이 없습니다.");
            error.status = 403;
            return next(error);
        }
    });


router.get('/', (req, res)=>{
    res.render('admin/admin');
});

router.get('/products', (req, res)=>{
    const user = req.session.user;
    const userId = user ? user.id : null;

    const query = `
        SELECT p.*, CASE WHEN w.product_id IS NOT NULL THEN 1 ELSE 0 END AS is_wished
        FROM products p
        LEFT JOIN wishlists w ON p.id = w.product_id AND w.user_id = ?
    `;

    db.all(query, [userId], (err, rows)=>{
        if (err) {
            const error = new Error("전체 상품을 불러오는데 실패하였습니다.");
            error.status = 500;
            return next(error);
        }

        //마찬가지로 찜한 상품 id 배열 추출
        const wishedProductIds = rows
            .filter(p => p.is_wished === 1)
            .map(p => p.id);

        res.render('admin/products',{
            products: rows,
            wishedProductIds: wishedProductIds, //템플릿으로 배열 전송
            user: user
        });
    });
});
//상품 추가
router.post('/products/add', (req, res) => {
    const { name, description, price, emoji, image, quantity } = req.body;
    const is_featured = req.body.is_featured === '1' ? 1 : 0;

    const insertQuery = `
        INSERT INTO products (name, description, price, emoji, image, quantity, is_featured)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(insertQuery, [name, description, price, emoji, image, quantity, is_featured], (err) => {
        if (err) {
            console.error('DB 신규 상품 추가 실패:', err.message);
            const error = new Error("신규 상품을 추가하는데 실패하였습니다.");
            error.status = 500;
            return next(error);
        }
        res.redirect('/admin/products');
    });
});

//상품 수정
router.post('/products/update', (req, res) => {
    const { productId, name, description, price, emoji, image, quantity } = req.body;

    const is_featured = req.body.is_featured === '1' ? 1 : 0;

    const query = `
        UPDATE products 
        SET name = ?, description = ?, price = ?, emoji = ?, image = ?, quantity = ?, is_featured = ?
        WHERE id = ?
    `;

    db.run(query, [name, description, price, emoji, image, quantity, is_featured, productId], (err) => {
        if (err) {
            console.error('관리자 상품 수정 처리 오류:', err.message);
            const error = new Error("상품을 수정하는데 실패하였습니다.");
            error.status = 500;
            return next(error);
        }
        res.redirect('/admin/products');
    });
});

//상품 삭제
router.post('/products/delete', (req, res) => {
    const { productId } = req.body;

    const deleteQuery = `
        DELETE FROM products 
        WHERE id = ?
    `;

    db.run(deleteQuery, [productId], (err) => {
        if (err) {
            console.error('DB 상품 삭제 실패:', err.message);
            const error = new Error("상품을 삭제하는데 실패하였습니다.");
            error.status = 500;
            return next(error);
        }
        res.redirect('/admin/products');
    });
});

router.get('/users', (req, res) => {
    const query = 'SELECT * FROM users';

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('회원 목록 조회 중 DB 에러 발생:', err.message);
            const error = new Error("회원 데이터를 불러오지 못하였습니다.");
            error.status = 500;
            return next(error);
        }

        res.render('admin/users', {
            users: rows,                    // DB에서 뽑아온 모든 회원 레코드 배열 (rows)
            user: req.session.user || null     // 현재 로그인 중인 관리자 세션 상태 연동
        });
    });
});

//회원정보 수정
router.post('/users/update', (req, res) => {
    const { userId, name, cash } = req.body;
    const currentUser = req.session.user;

    const updateQuery = `
        UPDATE users 
        SET name = ?, cash = ?
        WHERE id = ?
    `;

    db.run(updateQuery, [name, cash, userId], (err) => {
        if (err) {
            console.error('DB 오류: 회원 정보 변경 실패 -', err.message);
            const error = new Error("회원 정보 변경에 실패하였습니다.");
            error.status = 500;
            return next(error);
        }

        //운영자 자신의 정보를 바꿀 경우 세션에 반영
        if (currentUser && currentUser.id == userId){
            req.session.user.name = name;
            req.session.user.cash = Number(cash);
        }
        //수정 완료 후 리다이렉트
        res.redirect('/admin/users');
    });
});

router.get('/orders', (req, res) => {
    // orders, order_items, products, users 테이블을 결합하여
    // 주문 마스터 정보와 주문한 유저의 식별 정보, 상품 상세 정보를 한 번에 추출합니다.
    const query = `
        SELECT 
            o.id AS order_id,
            o.user_id,
            o.total_price,
            o.status,
            o.created_at,
            u.username AS buyer_username,
            u.name AS buyer_name,
            oi.product_id,
            oi.quantity,
            oi.order_price AS order_price,
            p.name AS product_name,
            p.emoji AS product_emoji
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        ORDER BY o.created_at DESC, o.id DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('DB 오류: 관리자 주문 내역 조회 실패 -', err.message);
            const error = new Error("주문 내역을 불러오는데 실패하였습니다.");
            error.status = 500;
            return next(error);
        }

        // 흩어진 Row 데이터를 주문 ID(order_id) 단위로 그룹화(Aggregation)합니다.
        const ordersMap = {};
        rows.forEach(row => {
            if (!ordersMap[row.order_id]) {
                ordersMap[row.order_id] = {
                    order_id: row.order_id,
                    user_id: row.user_id,
                    buyer_username: row.buyer_username,
                    buyer_name: row.buyer_name,
                    total_price: row.total_price,
                    status: row.status,
                    created_at: row.created_at,
                    items: []
                };
            }

            ordersMap[row.order_id].items.push({
                product_id: row.product_id,
                product_name: row.product_name || '삭제된 상품',
                product_emoji: row.product_emoji || '📦',
                quantity: row.quantity,
                order_price: row.order_price
            });
        });

        // 객체 맵을 배열로 변환하여 템플릿 엔진에 전달
        const allOrders = Object.values(ordersMap);

        res.render('admin/orders', {
            orders: allOrders,
        });
    });
});

// 2️⃣ 주문 상태 관리 제어 엔진 (결제완료/배송준비/배송중/배송완료/주문취소 상태 원격 업데이트)
router.post('/orders/update', (req, res) => {
    const { orderId, status } = req.body;

    const updateQuery = `
        UPDATE orders 
        SET status = ? 
        WHERE id = ?
    `;

    db.run(updateQuery, [status, orderId], (err) => {
        if (err) {
            console.error(`DB 오류: 주문 번호 #${orderId} 상태 변경 실패 -`, err.message);
            const error = new Error("주문의 상태 변경에 실패하였습니다.");
            error.status = 500;
            return next(error);
        }

        console.log(`[시스템 상태] 주문 번호 #${orderId}의 상태가 [${status}](으)로 갱신되었습니다.`);
        res.redirect('/admin/orders');
    });
});

module.exports = router;