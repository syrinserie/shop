const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

//마이페이지
router.get('/', (req, res)=>{
    const user = req.session.user;

    if (!user) {
        return res.status(401).render('login_required', {
            message: '마이페이지를 보기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    res.render('mypage', {user: user});
});

//위시리스트 갱신
router.post('/wishlist/update', (req, res, next)=>{
    const user = req.session.user;
    const { productId, action } = req.body;

    if(!user){
        return res.status(401).render('login_required', {
            message: '위시리스트에 추가하기 위해서는 로그인이 필요합니다.',
            redirectUrl: '../../user/login'
        });
    }

    //위시리스트 추가
    if (action === 'add'){
        const query = `INSERT INTO wishlists (user_id, product_id)
        VALUES (?, ?)
        ON CONFLICT(user_id, product_id) DO NOTHING
    `;

        db.run(query, [user.id, productId], function (err){
            if (err) {
                console.error('위시리스트 추가 실패:', err.message);
                const error = new Error("상품을 위시리스트에 추가하지 못하였습니다.");
                error.status = 500;
                return next(error);
            }
            res.redirect('../../mypage/wishlist');
        });
    }
    //위시리스트 제거
    else if (action === 'remove'){
        const deleteQuery = `
        DELETE FROM wishlists
        WHERE user_id = ? AND product_id = ?
        `;

        db.run(deleteQuery, [user.id, productId], function (err){
            if(err){
                console.error('위시리스트 제거 실패:', err.message);
                const error = new Error("상품을 위시리스트에서 제거하지 못하였습니다.");
                error.status = 500;
                return next(error);
            }
            res.redirect('../../mypage/wishlist');
        });
    }
    //잘못된 action
    else{
        res.status(400).send('잘못된 요청입니다.');
    }

});

//위시리스트 접속
router.get('/wishlist', (req, res, next)=>{
    const user = req.session.user;
    if (!user) {
        return res.status(401).render('login_required', {
            message: '위시리스트를 보기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const query = `
        SELECT p.* FROM products p
        WHERE p.id IN (
            SELECT w.product_id
            FROM wishlists w
            WHERE w.user_id = ?
        )
    `;

    db.all(query, [user.id], (err, rows) =>{
        if(err) {
            const error = new Error("위시리스트를 조회하지 못하였습니다.");
            error.status = 500;
            return next(error);
        }
        res.render('wishlist', {
            wishItems: rows,
            user});
    });
});

//회원 정보 접속
router.get('/userinfo', (req, res, next)=>{
    const user = req.session.user;

    if (!user) {
        return res.status(401).render('login_required', {
            message: '회원 정보를 보기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    res.render('userinfo', {user: user});
});

//회원 정보 수정
router.post('/userinfo/update', (req, res) => {
    const user = req.session.user;
    if (!user) {
        return res.status(401).render('login_required', {
            message: '정보를 수정하려면 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const { name } = req.body;

    const updateQuery = `
        UPDATE users 
        SET name = ?
        WHERE id = ?
    `;

    db.run(updateQuery, [name, user.id], (err) => {
        if (err) {
            console.error('DB 오류: 회원 자체 정보 변경 실패 -', err.message);
            const error = new Error("회원 정보를 변경하는데 실패하였습니다.");
            error.status = 500;
            return next(error);
        }

        //현재 클라이언트 브라우저 세션 스토리지의 닉네임 동기화
        req.session.user.name = name;

        //수정 완료 후 내 정보 관리 화면으로 안전하게 복귀
        res.redirect('../../mypage/userinfo');
    });
});

//회원 탈퇴
router.post('/userinfo/delete', (req, res, next) => {
    const user = req.session.user;
    if (!user) {
        return res.status(401).render('login_required', {
            message: '탈퇴 절차를 진행하려면 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const deleteQuery = `
        DELETE FROM users 
        WHERE id = ?
    `;

    db.run(deleteQuery, [user.id], (err) => {
        if (err) {
            console.error('DB 오류: 회원 탈퇴 처리 실패 -', err.message);
            const error = new Error("회원 탈퇴 처리 중 오류가 발생하였습니다.");
            error.status = 500;
            return next(error);
        }

        //세션 정보 제거
        req.session.destroy((errSession) => {
            if (errSession) {
                console.error('세션 제거 실패 -', errSession.message);
                const error = new Error("세션을 제거하는데 실패하였습니다.");
                error.status = 500;
                return next(error);
            }
            //홈화면으로 리다이렉트
            res.redirect('../');
        });
    });
});


router.get('/orderlist', (req, res, next)=>{
    const user = req.session.user;

    if (!user) {
        return res.status(401).render('login_required', {
            message: '주문 내역을 보기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    //현재 유저의 모든 주문 및 상세 상품 정보 가졍괴
    const query = `
        SELECT 
            o.id AS order_id,
            o.total_price,
            o.status,
            o.created_at,
            p.name AS product_name,
            p.emoji AS product_emoji,
            oi.order_price,
            oi.quantity
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
    `;

    db.all(query, [user.id], (err, rows) =>{
        if(err){
            console.error('주문 내역 조회 오류:', err.message);
            const error = new Error("주문 내역을 불러오지 못하였습니다.");
            error.status = 500;
            return next(error);
        }

        //같은 주문 번호를 기준으로 상품 배열을 묶기
        const groupedOrders = rows.reduce((acc, current) => {
            //acc에 현재 주문 번호가 등록되지 않았으면 등록
            if (!acc[current.order_id]) {
                acc[current.order_id] = {
                    order_id: current.order_id,
                    total_price: current.total_price,
                    status: current.status,
                    created_at: current.created_at,
                    items: []   //상품이 담길 배열
                };
            }

            //해당 주문 번호의 items에 상품 정보 추가
            acc[current.order_id].items.push({
                product_name: current.product_name,
                product_emoji: current.product_emoji,
                order_price: current.order_price,
                quantity: current.quantity
            });

            return acc;
        }, {});

        const finalOrderList = Object.values(groupedOrders);

        res.render('orderlist', {
            user: user,
            orders: finalOrderList
        });
    });
});
module.exports = router;