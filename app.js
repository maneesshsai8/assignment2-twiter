const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const pathFile = path.join(__dirname, "twitterClone.db");
const app = express();
app.use(express.json());
let db = null;

const InstallDb = async () => {
  try {
    db = await open({
      filename: pathFile,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("successfully Runs http://localhost:3000/");
    });
  } catch (e) {
    console.log(`e:${e.message}`);
  }
};
InstallDb();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUser = `SELECT * FROM user WHERE username = '${username}'`;
  const getRes = await db.get(getUser);
  if (getRes !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    const hashPassword = await bcrypt.hash(password, 10);
    if (password.length < 6) {
      console.log(password.length);
      response.status(400);
      response.send("Password is too short");
    } else {
      const addQuery = `INSERT INTO user (username,password,name,gender) VALUES('${username}','${hashPassword}','${name}','${gender}');`;
      const postQuery = await db.run(addQuery);
      const userId = postQuery.lastID;
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userDb = `SELECT * FROM user WHERE username = '${username}';`;
  const getRes = await db.get(userDb);
  if (getRes === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPassValid = await bcrypt.compare(password, getRes.password);
    if (isPassValid === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Secret_Message");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    const verifyToken = jwt.verify(
      jwtToken,
      "Secret_Message",
      (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      }
    );
  }
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getDb = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getRes = await db.get(getDb);
  const getFollowerDb = `SELECT user.username,tweet.tweet,tweet.date_time AS dateTime FROM user JOIN tweet ON user.user_id = tweet.user_id JOIN follower ON user.user_id = follower.following_user_id WHERE follower.following_user_id = ${getRes.user_id} ORDER BY dateTime DESC LIMIT 4`;
  const getResp = await db.all(getFollowerDb);
  response.send(getResp);
});
app.get("/followers/", async (request, response) => {
  const getDb = `SELECT * from follower;`;
  const getres = await db.all(getDb);
  response.send(getres);
});
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getDb = `SELECT user_id FROM user  WHERE username = '${username}';`;
  const getRes = await db.get(getDb);
  console.log(getRes);
  const getFollowerDb = `SELECT user.name FROM follower JOIN user ON user.user_id = follower.follower_user_id WHERE follower.following_user_id = ${getRes.user_id}`;
  const getResp = await db.all(getFollowerDb);
  response.send(getResp);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getDb = `SELECT user_id FROM user  WHERE username = '${username}';`;
  const getRes = await db.get(getDb);
  const getFollowerDb = `SELECT user.name FROM follower JOIN user ON user.user_id = follower.following_user_id WHERE follower.follower_user_id = ${getRes.user_id}`;
  const getResp = await db.all(getFollowerDb);
  response.send(getResp);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const userDb = `SELECT follower.following_user_id FROM user JOIN follower ON user.user_id = follower.follower_user_id WHERE user.username = '${username}'; `;
  const getRes = await db.get(userDb);
  //console.log(getRes);
  const tweetDB = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`;
  const tweetRes = await db.get(tweetDB);
  //console.log(tweetRes);
  if (getRes.following_user_id !== tweetRes.user_id) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getDb = `SELECT tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id) AS replies, tweet.date_time AS dateTime FROM tweet JOIN reply ON tweet.tweet_id = reply.tweet_id JOIN like ON like.tweet_id = tweet.tweet_id WHERE tweet.tweet_id = '${tweetId}' GROUP BY like.user_id; `;
    const getResponse = await db.get(getDb);
    response.send(getResponse);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userDb = `SELECT follower.following_user_id FROM user JOIN follower ON user.user_id = follower.follower_user_id WHERE user.username = '${username}'; `;
    const getRes = await db.get(userDb);
    //console.log(getRes);
    const tweetDB = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`;
    const tweetRes = await db.get(tweetDB);
    //console.log(tweetRes);
    if (getRes.following_user_id !== tweetRes.user_id) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getDb = `SELECT user.username FROM tweet JOIN like ON like.tweet_id = tweet.tweet_id JOIN user ON user.user_id = like.user_id WHERE tweet.tweet_id = '${tweetId}'; `;
      const getResponse = await db.all(getDb);
      let l = [];
      for (let each of getResponse) {
        l.push(each.username);
      }
      const result = { likes: l };
      response.send(result);
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userDb = `SELECT follower.following_user_id FROM user JOIN follower ON user.user_id = follower.follower_user_id WHERE user.username = '${username}'; `;
    const getRes = await db.get(userDb);
    //console.log(getRes);
    const tweetDB = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`;
    const tweetRes = await db.get(tweetDB);
    //console.log(tweetRes);
    if (getRes.following_user_id !== tweetRes.user_id) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getDb = `SELECT user.name, reply.reply FROM tweet JOIN reply ON reply.tweet_id = tweet.tweet_id JOIN user ON user.user_id = reply.user_id WHERE tweet.tweet_id = '${tweetId}'; `;
      const getResponse = await db.all(getDb);
      const result = { replies: getResponse };
      response.send(result);
    }
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userDb = `SELECT user.user_id FROM user JOIN follower ON user.user_id = follower.follower_user_id WHERE user.username = '${username}'; `;
  const getRes = await db.get(userDb);
  const getDb = `SELECT tweet.tweet,COUNT(like.like_id) AS likes,COUNT(reply.reply_id) AS replies, tweet.date_time AS dateTime FROM tweet JOIN reply ON tweet.tweet_id = reply.tweet_id JOIN like ON like.tweet_id = tweet.tweet_id WHERE tweet.user_id = ${getRes.user_id} GROUP BY tweet.tweet_id; `;
  const getResponse = await db.all(getDb);
  response.send(getResponse);
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet, dateTime = "" } = request.body;
  const getUser = `SELECT user_id FROM user WHERE username = '${username}';`;
  const userRes = await db.get(getUser);
  const postDb = `INSERT INTO tweet (tweet,user_id,date_time) VALUES ('${tweet}',${userRes.user_id},'${dateTime}');`;
  const getResponse = await db.run(postDb);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const userDb = `SELECT follower.following_user_id FROM user JOIN follower ON user.user_id = follower.follower_user_id WHERE user.username = '${username}'; `;
    const getRes = await db.get(userDb);
    //console.log(getRes);
    const tweetDB = `SELECT user_id FROM tweet WHERE tweet_id = '${tweetId}';`;
    const tweetRes = await db.get(tweetDB);
    //console.log(tweetRes);
    if (getRes.following_user_id !== tweetRes.user_id) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const delDb = `DELETE FROM tweet WHERE tweet_id = ${tweetId}`;
      await db.run(delDb);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
