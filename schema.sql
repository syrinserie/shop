--회원정보
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    cash INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0 --일반유저: 0, 관리자: 1
);

--게시글
CREATE TABLE IF NOT EXISTS posts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_id INTEGER, --NULL: 원글 값이 있으면 답글
    author TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

--파일 업로드 정보(첨부파일)
CREATE TABLE IF NOT EXISTS files(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    FOREIGN KEY(post_id) REFERENCES posts(id)
);

--상품목록
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    emoji TEXT,
    image TEXT,
    quantity INTEGER,
    likes INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0
);

--장바구니
DROP TABLE IF EXISTS cart_items ;
CREATE TABLE cart_items(
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, product_id)
);

--위시리스트
CREATE TABLE IF NOT EXISTS wishlists (
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, product_id), -- 한 유저가 동일 상품을 중복 찜하는 것 방지
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

--주문 정보
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_price INTEGER NOT NULL, --주문금액
    status TEXT DEFAULT '결제완료', --주문상태: 결제완료-배송준비-배송중-배송완료-주문취소
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

--주문 상세내역
CREATE TABLE IF NOT EXISTS order_items(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    order_price INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
);