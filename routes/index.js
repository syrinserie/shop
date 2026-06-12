const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

/* GET home page. */
router.get('/', function(req, res, next) {
  const user = req.session.user;
  const userId = user ? user.id : null;

  //위시리스트에 추가한 상품인지 확인해서 전체 상품 가져오기
  const allProductsQuery = `
        SELECT p.*, CASE WHEN w.product_id IS NOT NULL THEN 1 ELSE 0 END AS is_wished
        FROM products p
                 LEFT JOIN wishlists w ON p.id = w.product_id AND w.user_id = ?
    `;

  db.all(allProductsQuery, [userId], (err, allProducts) => {
    if (err) {
      const error = new Error("전체 상품을 불러오는데 실패하였습니다.");
      error.status = 500;
      return next(error);
    }

    //추천 상품도 위시리스트 추가여부 결합해서 조회
    const featuredQuery = `
            SELECT p.*, CASE WHEN w.product_id IS NOT NULL THEN 1 ELSE 0 END AS is_wished
            FROM products p
                     LEFT JOIN wishlists w ON p.id = w.product_id AND w.user_id = ?
            WHERE p.is_featured = 1
            ORDER BY p.likes DESC LIMIT 4
        `;

    db.all(featuredQuery, [userId], (err2, featuredProducts) => {
      if (err2) {
        const error = new Error("추천 상품을 불러오는데 실패하였습니다.");
        error.status = 500;
        return next(error);
      }

      //찜한 상품들의 ID만 모아서 심플한 배열 생성
      //로그인 상태가 아닐 때는 빈 배열
      const wishedProductIds = allProducts
          .filter(product => product.is_wished === 1)
          .map(product => product.id);

      res.render('index', {
        allProducts: allProducts,
        featuredProducts: featuredProducts,
        wishedProductIds: wishedProductIds, // 템플릿으로 배열 전송
        user: user,
        title: '사이버쇼핑몰'
      });
    });
  });
});

module.exports = router;
