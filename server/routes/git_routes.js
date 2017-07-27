const router = require('express').Router();
const User = require("../models/user");
const GitHubApi = require("github");
const _ = require('underscore');


const github = new GitHubApi({
    debug: true,
    protocol: "https",
    host: "api.github.com", // should be api.github.com for GitHub
    pathPrefix: "", // for some GHEs; none for GitHub
    headers: {
        "user-agent": "GitStreak" // GitHub is happy with a unique user agent
    },
    Promise: require('bluebird'),
    followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
    timeout: 5000
});

//Get repos
router.get('/getRepos', (req,res) => {
  if(!req.user) { return res.status(200).send({}); };

  github.authenticate({
      type: "token",
      token: req.user.accessToken,
  });

  var repos = [];
  github.repos.getAll({
    sort: 'updated',
    per_page: '100' //Get more than 100 later
  })
  .then((data) => {
    repos = data.data;
    return User.findOne({id:req.user.id}).exec();
  })
  .then((user) => { //Improve 2 for loops later
    var repoExists = false;
    for(var i = 0; i < repos.length; i++){//For each repository, check if it already exists in database
      repoExists = false;
      for(var j = 0; j < user.repos.length; j++){
        if(user.repos[j].owner === repos[i].owner.login && user.repos[j].name === repos[i].name){
          // console.log('Repository exists at ', user.repos[j].owner,'/',user.repos[j].name);
          repoExists = true;
          j = user.repos.length;
        }
      }
      if(!repoExists){
        // console.log('The repository ', repos[i].name, ' did not exist, so it was created.');
        user.repos.push({
          owner: repos[i].owner.login ,
          name:repos[i].name,
          additions: '0',
          deletions: '0',
          total: '0',
          commits: '0',
          hook: {tracked: false, id: ''},
          newCommits: [],
          weeks: []
        });
      }
    };
    user.markModified('repos');
    return user.save();
  })
  .then((saved) => {
    return res.status(200).send(saved.repos);
  })
  .catch((err) => {
    return res.status(200).send({});
  });
});

//Create a webhook
router.post('/createHook', (req,res) => {
  console.log("The owner is %s and repo is %s", req.body.owner, req.body.name);

  github.authenticate({
      type: "token",
      token: req.user.accessToken,
  });

  github.repos.createHook({
    owner: "shree",
    repo: "basic",
    active: true,
    name: "web",
    config: {
        url: "http://gitstreek.herokuapp.com/git/hookListener",
        content_type: "json",
        insecure_ssl: "0"
    }
  })
  .then((data) => {
      console.log(data);
      res.status(200).send({});
  })
  .catch((err) => {
      console.log(err);
  });
});

//Recieve payload from webhook and update my database
router.post('hookListener', (req,res) => {
  // User.findOne({id:req.body.sender.id}, function(err,user){
  //   if(err) { return 'err' }
  //   user.trackedRepos.push(req.body);
  //   user.markModified('trackedRepos');
  //   user.save();
  // })
});



















//Get Repositroy Stats
router.get('/getRepoInfo', function(req,res) {

  github.authenticate({
      type: "token",
      token: req.user.accessToken,
  });

  github.repos.getStatsContributors({
    owner: "shree",
    repo: "myProjectTemplates"
  })
  .then((data) => {
    if(data.meta.status === "200 OK") { //Pass on data
      return dataPromise(data);
    }else { //Wait 10seconds and make a request again
      return delayPromise(10000);
    }
  })
  .then((data) => {
    if(data) { //Pass on Data
      return dataPromise(data);
    }else { //Dealing with 202 after 10seconds
      return github.repos.getStatsContributors({
        owner: "shree",
        repo: "myProjectTemplates"
      });
    }
  })
  .then((data) =>{ //Send response to client
    console.log(data.data);
    res.redirect('/');
  })
  .catch((err) => {
    console.log(err);
  });
});


//Custom Promises
var dataPromise = (data) => {
  return new Promise((resolve, reject) => {
    resolve(data);
  });
}

var delayPromise = (duration) => {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
      resolve();
		}, duration);
	});
};


module.exports = router;
