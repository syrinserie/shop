//운영자 계정 추가 코드
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

//운영자 계정 기본값
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '1234';
const ADMIN_NAME = '운영자'
const ADMIN_CASH = 0;

db.serialize(async () => {
    db.get('SELECT COUNT(*) AS count FROM users WHERE username = ?', [ADMIN_USERNAME], async (err, row) => {
        if (err) {
            console.error('users 테이블 조회 오류:', err.message);
            return db.close();
        }

        if (row.count === 0) {
            try {
                const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

                const query = `
                    INSERT INTO users (username, password, name, cash, is_admin) 
                    VALUES (?, ?, ?, ?, ?)
                `;

                db.run(query, [ADMIN_USERNAME, hashedPassword, ADMIN_NAME, ADMIN_CASH, 1], function(insertErr) {
                    if (insertErr) {
                        console.error('관리자 계정 생성 실패:', insertErr.message);
                    } else {
                        console.log(`관리자 계정 생성 성공 (ID: ${ADMIN_USERNAME} / PW: ${ADMIN_PASSWORD})`);
                    }
                    db.close();
                });
            } catch (hashErr) {
                console.error('비밀번호 암호화 오류:', hashErr.message);
                db.close();
            }
        } else {
            console.log(`이미 "${ADMIN_USERNAME}" 아이디를 가진 유저가 존재합니다. 생략합니다.`);
            db.close();
        }
    });
});

