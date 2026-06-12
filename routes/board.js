const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.join(__dirname, '../db/database.sqlite');
const db = new sqlite3.Database(dbPath);

//게시글 목록
router.get('/',(req,res, next)=>{
    db.all('SELECT * FROM posts ORDER BY COALESCE(parent_id, id),id ASC',
        [],(err, posts)=>{
        if(err) {
            const error = new Error("글 목록을 불러오는데 실패하였습니다.");
            error.status = 500;
            return next(error);
        }
        res.render('board',{
            posts,
            user: req.session.user
        });
        });
});

//글쓰기 폼
router.get('/new', (req,res)=>{
    res.render('post', {
        post: null,
        parentId: null,
        user: req.session.user || null
        });
})

//글쓰기 처리
router.post('/new',(req,res, next)=>{
    const {title, content, parent_id} = req.body;
    const author = req.session.user?.username || '익명';

    db.run('INSERT INTO posts(title, content, parent_id, author) VALUES(?,?,?,?)',
        [title, content, parent_id || null, author],
        function(err){
        if(err) {
            const error = new Error("글쓰기에 실패하였습니다.");
            error.status = 500;
            return next(error);
        }
        res.redirect('/board');
        });
});

//글 상세
router.get('/view/:id', (req, res, next)=>{
    const postid = req.params.id;

    db.get('SELECT * FROM posts WHERE id = ?',[postid], (err,post)=>{
        if(err||!post) {
            const error = new Error("해당 글이 존재하지 않습니다.");
            error.status = 404;
            return next(error);
        }
        res.render('detail', {post});
    })
});

//답글 폼
router.get('/reply/:id', (req,res, next)=>{
    const parentId = req.params.id;
    db.get("SELECT title FROM posts WHERE id = ?", [parentId],(err,row)=>{
        if(err || !row) {
            const error = new Error("원글이 존재하지 않습니다.");
            error.status = 404;
            return next(error);
        }
        res.render('reply',{
            parentId,
            parentTitle: row.title,
            user: req.session.user || null
        });
    });
});

//수정 폼
router.get('/edit/:id',(req,res, next)=>{
    db.get('SELECT * FROM posts WHERE id = ?', [req.params.id],(err,post)=>{
        if(err||!post) {
            const error = new Error("존재하지 않는 글입니다.");
            error.status = 404;
            return next(error);
        }
        res.render('post',{post});
    });
});

//수정
router.post('/edit/:id',(req,res, next)=>{
    const postId = req.params.id;
    const {title, content} = req.body;
    const user = req.session.user;

    if(!user){
        return res.status(401).render('login_required', {
            message: '글을 수정하기 위해서는 로그인이 필요합니다.',
            redirectUrl: '../../user/login'
        });
    }

    const currentUser = user.username;
    const isAdmin = user.isAdmin === 1;
    const isAnon = user.username === '익명';

    db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post)=>{
        if(err || !post) {
            const error = new Error("존재하지 않는 글입니다.");
            error.status = 404;
            return next(error);
        }

        if(!isAdmin){
            if(isAnon || post.author === '익명'){
                const error = new Error("익명 작성된 글은 관리자만 수정할 수 있습니다.");
                error.status = 403;
                return next(error);
            }
            else if(currentUser !== post.author){
                const error = new Error("본인이 작성한 글만 수정할 수 있습니다.");
                error.status = 403;
                return next(error);
            }
        }

        db.run('UPDATE posts SET title = ?, content = ? WHERE id = ?', [title, content, req.params.id], (updateErr)=>{
                if(updateErr) {
                    const error = new Error("글을 수정하지 못했습니다.");
                    error.status = 500;
                    return next(error);
                }
                res.redirect(`../../board/view/${postId}`);
            }
        );
    });

});

//삭제
router.get('/delete/:id', (req, res)=>{
    const postId = req.params.id;
    const {title, content} = req.body;
    const user = req.session.user;

    if(!user){
        return res.status(401).render('login_required', {
            message: '글을 삭제하기 위해서는 로그인이 필요합니다.',
            redirectUrl: '/user/login'
        });
    }

    const currentUser = user.username;
    const isAdmin = user.isAdmin === 1;
    const isAnon = user.username === '익명';

    db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post)=>{
        if(err || !post) {
            const error = new Error("존재하지 않는 글입니다.");
            error.status = 404;
            return next(error);
        }

        if(!isAdmin){
            if(isAnon || post.author === '익명'){
                const error = new Error("익명 작성된 글은 관리자만 삭제할 수 있습니다.");
                error.status = 403;
                return next(error);
            }
            else if(currentUser !== post.author){
                const error = new Error("본인이 작성한 글만 삭제할 수 있습니다.");
                error.status = 403;
                return next(error);
            }
        }

        db.run('DELETE FROM posts WHERE id = ?', [postId], (delErr)=>{
                if(delErr) {
                    const error = new Error("글을 삭제하지 못했습니다.");
                    error.status = 500;
                    return next(error);
                }
                res.redirect(`/board`);
            }
        );
    });
});

router.post('/create', (req, res)=>{
    const {author, title, content, parent_id} = req.body;
    db.run(
        'INSERT INTO posts (author, title, content, parent_id) VALUES(?, ?, ?, ?)',
        [author, title, content, parent_id || null],
        function (err){
            if(err) {
                const error = new Error("글을 등록하지 못했습니다.");
                error.status = 500;
                return next(error);
            }
            res.redirect('/board');
        }
    )
})

module.exports = router;