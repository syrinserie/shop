const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

router.get('/register',(req, res) =>{
    res.render('register');
});

router.post('/register', async (req, res, next)=>{
    const {username, password, name} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        'INSERT INTO users(username, password, name) VALUES (?,?,?)',
        [username, hashedPassword, name],
        (err)=>{
            if(err){
                console.error(err.message);
                const error = new Error("회원 가입에 실패하였습니다.");
                error.status = 500;
                return next(error);
            }
            res.redirect('./login');
        }
    );
});

router.get('/login', (req, res)=>{
    res.render('login');
})

router.post('/login', (req, res, next)=>{
    const {username, password} = req.body;

    db.get('SELECT * FROM users WHERE username = ?',[username], async (err, user)=>{
        if(err || !user){
            return res.status(401).render('login_failed', {message: '존재하지 않는 아이디입니다.'});
        }

        const match = await bcrypt.compare(password, user.password);
        if(match) {
            req.session.user = {
                id: user.id,
                username: user.username,
                name: user.name,
                cash: user.cash,
                isAdmin: user.is_admin
            }
            res.redirect("../");
        } else{
            return res.status(401).render('login_failed', {message: '비밀번호를 틀렸습니다.'});
        }
    });
});

router.get('/logout', (req, res)=>{
    req.session.destroy();
    res.redirect('../');
});



module.exports = router;