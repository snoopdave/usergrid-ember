usergrid-emberjs
===

This is an Apache Usergrid / Ember.js example.
It shows how to login via Usergrid and use Ember-Data to create and retrieve Usergrid Activities.

Prerequisites
---
To build and run Usergrid-Ember you will need NPM, Grunt and Bower installed on your computer.
* __NPM__: install from the [NPM](http://npmjs.org) website.
* __Grunt__: install this via the NPM tool, for example `npm install -g grunt-cli`
* __Bower__: install this via the NPM tool, for example `npm install -g bower`

How to build Usergrid-Ember
---
1. Run `./build.sh` to download dependencies, uglify and concatenate them into build/all-deps.js and build/all-deps.css.
2. Run `grunt web-server` to launch in a simple web server, then browse to
[http://localhost:8080/index.html](http://localhost:8080/index.html) to see the app in action

Other notes
---
By default Apigee's API BaaS hosted version of Apache Usergrid and it uses the "checkin1" application of the
author's "snoopdave" organization. You can use your own API BaaS application if you wish. Just go to the
Apigee.com site and sign up for a free account. Then make sure you change the code in app.js to point to your app
like so:

    Usergrid = {
        orgName: "YOUR_ORGANIZATION_NAME",
        appName: "YOUR_APPLICATION_NAME",
        uri: "https://api.usergrid.com",
        getAppUrl : function() {
            return this.uri + "/" + this.orgName + "/" + this.appName;
        }
    };

