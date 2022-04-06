let express = require("express");
let app = express();

app.use(express.urlencoded({ extended: true }));  // parses the urlencoded body

let handlebars = require("express-handlebars");
app.engine("handlebars", handlebars.engine({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

let sqlite3 = require("sqlite3").verbose();
let db = new sqlite3.Database("./db.sqlite3");

app.use(express.static("public"));

// import "express-session" into our program
let session = require("express-session");

// use it in our app，是否为合法用户
app.use(
  session({
    secret: "some secret code",
    resave: false, // forces sessions to be saved
    saveUninitialized: false // forces uninitialized sessions to be saved
  })
);

let limitLength = function (string, maxLength) {
  if (string.length > maxLength) {
    string = string.slice(0, maxLength) + "...";
  }
  return string;
}

app.get("/", function (req, res) {
  if (!req.session['username']) {
    res.render("login", { layout: false });  // renders the form in login.handlebars
  } else {
    db.all("SELECT *, DATETIME(time_added, 'localtime') as time_added FROM post ORDER BY likes DESC", [], function (err, rows) {
      res.render("posts", {
        posts: rows,
        helpers: {
          limit: limitLength //内容超出20字符，显示。。。
        },
        name: req.session['username']
      });
    });
  }
});

//验证用户名是否存在，12月13日更新
app.get("/checkUser", function (req, res) {
  let username = req.query.username;
  db.get("SELECT * FROM user WHERE username = ?", username, function (err, user) {
    if (user) {
      res.json({ "available": false });
    } else {
      res.json({ "available": true });
    }
  });
});

//注册，一旦注册完成（这里选择路径2）路径1：直接进入论坛或者题库；路径2：返回登录界面，再进入题库.
app.post("/signup", function (req, res) {
  let account = req.body.newaccount;
  let password = req.body.password1;
  let password2 = req.body.password2 //注意，只取第一个密码定义为password（因为前提设置第二次密码不同弹出警告，直到2次密码相同）
  console.log(account);
  console.log(password);
  console.log(password2);
  if (account.length <= 6 && password.length >= 3 && password === password2) {
    //先把用户注册的信息(前提不超过6个字符）写进数据库,直接放在login表中
    db.run("INSERT INTO user(username, password) VALUES(?,?)", [account, password], function (err, rows) {
      console.log(err);
      res.redirect("/"); //注册成功，返回登录页
    });
  } else {
    res.redirect("back");
  }
})

// Authenticating users by checking the database，设置登录页面细节
app.post("/login", function (req, res) {
  let username = req.body['username'];
  let password = req.body['password'];
  db.get("SELECT * FROM user WHERE username=? AND password=?", [username, password], function (err, row) {
    if (row) {
      console.log(err);
      req.session['username'] = username;
      res.redirect("/");//登录成功，进入论坛
    } else {
      res.redirect("back");
    }
  });
});

// log out the user
app.get("/logout", function (req, res) {
  req.session.destroy();
  res.redirect("/");
});

//下面是用户对帖子进行增删，用户权限功能还在开发中
app.post("/", function (req, res) {
  let title = req.body["title"];
  let content = req.body["content"];
  let username = req.body["username"];
  db.run("INSERT INTO post(Title, Content, Username) VALUES(?,?,?)", [title, content, username], function (err) {
    console.log(err);
    res.redirect("back");
  });
});

app.get("/delete/:id", function (req, res) {
  db.get("SELECT username FROM post WHERE id = ?", req.params["id"], function (err, un) {
    let username = un.username;
    if (username == req.session['username']) {
      db.run("DELETE FROM post WHERE id=?", req.params["id"], function (err) {
        res.redirect("back");
        console.log("删除成功");
      });
    } else {
      console.log("无权删帖");
      res.redirect("back");
    }
  });
});

//主页点赞功能
app.get("/like/:id", function (req, res) {
  db.get("SELECT likes FROM post WHERE id=?", req.params["id"], function (err, rows) {
    let likes = rows.likes;
    likes++;
    console.log(likes, err);
    res.redirect("back");
    db.run("UPDATE post SET likes = ? WHERE id = ?", [likes, req.params["id"]], function (err) {
      console.log(err);
    });
  });
});

//下面是view页面即帖子详细页面
app.get('/view/:id', function (req, res) {
  let postID = req.params['id'];
  db.get("SELECT *, DATETIME(time_added, 'localtime') as time_added FROM post WHERE id=?", [postID], function (err, post) {
    db.all("SELECT *, DATETIME(time_added, 'localtime') as time_added FROM comments WHERE post_id=? ORDER BY likes DESC", [postID], function (err, comments) {
      console.log(post, comments, err);
      res.render("view", {
        "post": post,
        "comments": comments,
        name: req.session['username']
      });
    })
  });
});

app.post("/newComment", function (req, res) {
  let comment = req.body["comment"];
  let post_id = req.body["postid"];
  let username = req.body["username"];
  db.run("INSERT INTO comments(Content, post_id, Username) VALUES(?,?,?)", [comment, post_id, username], function (err) {
    res.redirect("back");
  });
});

//评论删除功能
app.get("/deleteCom/:id", function (req, res) {
  db.get("SELECT username FROM comments WHERE id = ?", req.params["id"], function (err, un) {
    let username = un.username;
    if (username == req.session['username']) {
      db.run("DELETE FROM comments WHERE id=?", req.params["id"], function (err) {
        res.redirect("back");
        console.log("删除成功");
      });
    } else {
      console.log("无权删帖");
      res.redirect("back");
    }
  });
});

//评论点赞功能
app.get("/likeCom/:id", function (req, res) {
  db.get("SELECT likes FROM comments WHERE id=?", req.params["id"], function (err, rows) {
    let likes = rows.likes;
    likes++;
    console.log(likes, err);
    res.redirect("back");
    db.run("UPDATE comments SET likes = ? WHERE id = ?", [likes, req.params["id"]], function (err) {
      console.log(err);
    });
  });
});

//题库创建，想实现点击导航栏任意历年真题调用出相应的题库内容,链接handlebars模板
app.get("/bank/:year", function (req, res) {
  console.log(req.params['year'], req.session['username']);
  db.all("SELECT * FROM banks WHERE year = ?", req.params['year'], function (err, rows) {
    console.log(err);
    res.render("bank", {
      banks: rows,
      name: req.session['username']
    })
  })
});

app.get("/type/:type", function (req, res) {
  console.log(req.params['type'], req.session['username']);
  db.all("SELECT * FROM banks WHERE type = ?", req.params['type'], function (err, rows) {
    console.log(err);
    res.render("bank", {
      banks: rows,
      name: req.session['username']
    })
  })
});


//答案上传
app.post("/yes", function (req, res) {
  let timu_id = req.body["timu_id"];
  for (let i = 0; i < timu_id.length; i++) {
    let ans = req.body[timu_id[i]];
    db.run("UPDATE banks SET user_choice = ? WHERE id = ?", [ans, timu_id[i]], function (err) {
      console.log(err);
    });
  }
  let newIds = "";
  for (let i = 0; i < timu_id.length; i++) {
    newIds += timu_id[i];
    if (i < timu_id.length - 1) {
      newIds += ",";
    }
  }
  newIds = "SELECT * FROM banks WHERE id in (" + newIds + ")";
  db.all(newIds, [], function (err, rows) {
    console.log(err, rows);
    res.render("answer", {
      banks: rows,
      name: req.session['username']
    })
  });
});

//下面是题目详细页面
app.get('/ansview/:id', function (req, res) {
  let postID = req.params['id'];
  console.log(postID);
  db.get("SELECT * FROM banks WHERE id=? ORDER BY id DESC", [postID], function (err, post) {
    db.all("SELECT *, DATETIME(time_added, 'localtime') as time_added FROM anscomments WHERE timu_id=? ORDER BY likes DESC", [postID], function (err, comments) {
      res.render("ansview", {
        "post": post,
        "comments": comments,
        name: req.session['username']
      });
    })
  });
});

app.post("/newAnsComment", function (req, res) {
  let comment = req.body["comment"];
  let post_id = req.body["postid"];
  let username = req.body["username"];
  let likes = 0;
  db.run("INSERT INTO anscomments(Content, timu_id, Username, likes) VALUES(?,?,?,?)", [comment, post_id, username, likes], function (err) {
    res.redirect("back");
    console.log(comment, post_id, username, err);
  });
});

app.get("/deleteAnsCom/:id", function (req, res) {
  db.get("SELECT username FROM anscomments WHERE id = ?", req.params["id"], function (err, un) {
    let username = un.username;
    if (username == req.session['username']) {
      db.run("DELETE FROM anscomments WHERE id=?", req.params["id"], function (err) {
        res.redirect("back");
        console.log("删除成功");
      });
    } else {
      console.log("无权删帖");
      res.redirect("back");
    }
  });
});

app.get("/likeAnsCom/:id", function (req, res) {
  db.get("SELECT likes FROM anscomments WHERE id=?", req.params["id"], function (err, rows) {
    let likes = rows.likes;
    likes++;
    console.log(likes, err);
    res.redirect("back");
    db.run("UPDATE anscomments SET likes = ? WHERE id = ?", [likes, req.params["id"]], function (err) {
      console.log(err);
    });
  });
});

// 仿真考场
app.get("/exam", function (req, res) {
  console.log(req.params['year']);
  // 这里暂时写死，采用2021年的题目
  db.all("SELECT * FROM banks WHERE year = 2021", req.params['year'], function (err, rows) {
    console.log(err);
    res.render("exam", {
      banks: rows,
      name: req.session['username']
    })
  })
});

//为爱发电页面
app.get("/love", function (req, res) {
  res.render("love", {
    name: req.session['username']
  });
});

app.post("/upload", function (req, res) {
  res.redirect("back");
});

//随机页面
app.get("/random", function (req, res) {
  let newIds = "";
  for (let i = 0; i < 5; i++) {
    newIds += Math.floor(Math.random() * 32 + 1);
    if (i < 4) {
      newIds += ",";
    }
  }
  newIds = "SELECT * FROM banks WHERE rowid in (" + newIds + ")";
  console.log(newIds);
  db.all(newIds, [], function (err, rows) {
    res.render("bank", {
      banks: rows,
      name: req.session['username']
    })
  });
});

app.listen(8000, function () {
  console.log("Listening on port 8000");
});
