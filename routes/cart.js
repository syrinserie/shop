const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

router.post('/add', (req, res, next)=>{
    const user = req.session.user;
    const productId = req.body.productId;

    if(!user){
        return res.status(401).render('login_required', {
            message: '장바구니에 담기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const query = 'INSERT INTO cart_items (user_id, product_id, quantity)' +
        'VALUES (?, ?, 1)' +
        'ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + 1';

    db.run(query, [user.id, productId], function (err){
        if (err) {
            const error = new Error("장바구니에 상품을 담지 못했습니다.");
            error.status = 500;
            return next(error);
        }
        res.redirect('./');
    });
});

router.get('/', (req, res, next)=>{
    const user = req.session.user;
    if (!user) {
        return res.status(401).render('login_required', {
            message: '장바구니를 보기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const query = `
        SELECT p.id, p.name, p.price, p.emoji, p.image, c.quantity
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
    `;

    db.all(query, [user.id], (err, rows) =>{
        if(err) {
            const error = new Error("장바구니를 조회하지 못했습니다.");
            error.status = 500;
            return next(error);
        }
        res.render('cart', {cartItems: rows, user});
    });
});

router.post('/update', (req, res, next) => {
    const user = req.session.user;
    const { productId, action } = req.body;

    if(!user) return res.redirect('../user/login');

    const checkQuery = 'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?';
    db.get(checkQuery, [user.id, productId], (err, row) => {
        if (err) {
            console.error('수량 조회 실패: ', err.message);
            const error = new Error("상품 수량을 조회하지 못했습니다.");
            error.status = 500;
            return next(error);
        }
        //상품 수 1 증가
        if(action === 'increase'){
            const updateQuery = 'UPDATE cart_items SET quantity = quantity + 1 WHERE user_id = ? AND product_id = ?';
            db.run(updateQuery, [user.id, productId], (err)=>{
                if(err){
                    console.error('수량 증가 실패:', err.message);
                    const error = new Error("상품 수량을 증가시키지 못했습니다.");
                    error.status = 500;
                    return next(error);
                }
                res.redirect('../cart');
            });
        }
        //상품 수 1 감소
        else{
            //2개 이상 있을때
            if(row.quantity > 1){
                const updateQuery = 'UPDATE cart_items SET quantity = quantity - 1 WHERE user_id = ? AND product_id = ?';
                db.run(updateQuery, [user.id, productId], (err)=>{
                    if(err){
                        console.error('수량 감소 실패:', err.message);
                        const error = new Error("상품 수량을 감소시키지 못했습니다.");
                        error.status = 500;
                        return next(error);
                    }
                    res.redirect('../cart');
                });
            }
            //1개 밖에 없으면 그냥 제거
            else{
                const deleteQuery = 'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?';
                db.run(deleteQuery, [user.id, productId], (err)=>{
                    if(err){
                        console.error('삭제 실패:', err.message);
                        const error = new Error("상품을 제거하지 못하였습니다.");
                        error.status = 500;
                        return next(error);
                    }
                    res.redirect('../cart');
                });
            }
        }

    });

});

router.post('/delete', (req, res, next)=>{
    const user = req.session.user;
    const { productId } = req.body;

    if(!user) return res.redirect('../user/login');

    const checkQuery = 'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?';
    db.get(checkQuery, [user.id, productId], (err, row) =>{
        if(err){
            console.error('수량 조회 실패: ',err.message);
            const error = new Error("상품 수량을 조회하지 못하였습니다.");
            error.status = 500;
            return next(error);
        }

        //수량 0개 -> 리다이렉트
        if(!row) return res.redirect('../cart');

        //수량 1개 이상 -> 제거
        else{
            const deleteQuery = 'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?';
            db.run(deleteQuery, [user.id, productId], (err)=>{
                if(err){
                    console.error('삭제 실패:', err.message);
                    const error = new Error("상품을 삭제하지 못하였습니다.");
                    error.status = 500;
                    return next(error);
                }
                res.redirect('../cart');
            });
        }
    });
});

module.exports = router;