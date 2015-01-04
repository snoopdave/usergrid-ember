/*
 * Licensed under  the  Apache  License, Version 2.0 (the "License") you may not 
 * use this file except in compliance with the License. You may obtain a copy of 
 * the License at:
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless  required  by  applicable  law  or  agreed  to  in  writing,  software 
 * distributed  under  the  License  is distributed on an "AS IS" BASIS, WITHOUT 
 * WARRANTIES OR CONDITIONS OF ANY  KIND,  either  express  or implied.  See the 
 * License for the specific language governing permissions and limitations under 
 * the License.
 */

// Example illustrates Usergrid login via Ember and w/o Usergrid JavaScript SDK


App = Ember.Application.create();

App.Router.map(function() {
  this.route("login", { path: "/login" });
  this.route("logout", { path: "/logout" });
  this.route("add-checkin", { path: "/add-checkin" });
});

Usergrid = {
  orgName: "snoopdave",
  appName: "checkin1",
  uri: "https://api.usergrid.com",
  getAppUrl : function() {
    return this.uri + "/" + this.orgName + "/" + this.appName;
  }
};


//------------------------------------------------------------------------------
// Setup Ember-Data 

App.ApplicationAdapter = DS.RESTAdapter.extend({

  host: Usergrid.getAppUrl(),

  headers: function() { 
    return { "Authorization": "Bearer " + localStorage.getItem("access_token") }; 
  }.property().volatile(), // ensure value not cached

  pathForType: function(type) {
    var ret = Ember.String.camelize(type);
    ret = Ember.String.pluralize(ret);
    if ( ret == "newActivities" ) {
      ret = "/users/" + Usergrid.user.username + "/activities";
    }
    return ret;
  }

});

App.ApplicationStore = DS.Store.extend({
  adapter: App.ApplicationAdapter.create() 
});

App.store = App.ApplicationStore.create();

// extend serializer to handle Usergrid JSON formal
App.ApplicationSerializer = DS.RESTSerializer.extend({

  // extract array from Usergrid response
  extractArray: function(store, type, payload) {

    // Usergrid returns array of objects in field named 'entities'
    var arrayName = payload.path.substring(1);
    payload[ arrayName ] = payload.entities;

    // Usergrid returns id in field named 'uuid'
    for ( var i in payload.entities ) {
      if ( payload.entities[i] && payload.entities[i].uuid ) {
        payload.entities[i].id = payload.entities[i].uuid;
      }
    }
    return this._super(store, type, payload);
  },

  // serialize JSON object that will be sent to Usergrid
  serializeIntoHash: function( hash, type, record, options ) {

    // Usergrid does not expect a type key
    record.eachAttribute(function( name, meta ) {
      hash[name] = record.get(name);
    });

    return hash;
  },
});

App.NewActivity = DS.Model.extend({
  content: DS.attr('string'),
  location: DS.attr('string'),
  actor: DS.attr('string'),
  verb: DS.attr('string')
});

App.Activity = DS.Model.extend({
  uuid: DS.attr('string'),
  type: DS.attr('string'),
  content: DS.attr('string'),
  location: DS.attr('string'),
  created: DS.attr('date'),
  modified: DS.attr('date'),
  actor: DS.attr('string'),
  verb: DS.attr('string'),
  published: DS.attr('date'),
  metadata: DS.attr('string')
});


//------------------------------------------------------------------------------
// Index page with logout link

App.IndexRoute = Ember.Route.extend({

  loggedIn: function() {
    return localStorage.getItem("username") && localStorage.getItem("access_token"); 
  },

  beforeModel: function() { // check to see it we are logged in 

    if ( this.loggedIn() ) { 

        $.ajax({ 
            context: this,
            type: "GET",
            url: Usergrid.getAppUrl() + "/users/" + localStorage.getItem("username"),
            headers: { 
              "Authorization": "Bearer " + localStorage.getItem("access_token") 
            },
            error: function( data ) {
              localStorage.removeItem("username");
              localStorage.removeItem("access_token"); 
              this.transitionTo("login"); // hmm, token expired? need to login
            },
            success: function( data ) { 
              Usergrid.user = data.entities[0];
            }
        });
        
    } else { // no token, user must login
        this.transitionTo("login"); 
    } 
  },

  model: function() {
    if ( this.loggedIn() ) {
      return this.store.find("activity");
    }
    return [];
  },

  actions: {
    login: function() {
      this.transitionTo("login"); 
    }
  }

});


App.IndexController = Ember.Controller.extend({
  actions: {

    addCheckin: function() {
      this.transitionTo("add-checkin"); 
    },

    logout: function() {
      Usergrid.user = null;
      localStorage.removeItem("username");
      localStorage.removeItem("access_token"); 
      this.get("target").send("login");
    }
  }
});


//------------------------------------------------------------------------------
// Login 

App.LoginController = Ember.Controller.extend({
  actions: {

    login: function() { // login by POST to /token end-point

      var loginData = {
        grant_type: "password", 
        username: this.get("username"), 
        password: this.get("password")
      };

      $.ajax({ 
        type: "POST",
        url: Usergrid.getAppUrl() + "/token",
        data: loginData,
        context: this,
        error: function( data ) {
          alert( data.responseJSON.error_description );  
        },
        success: function( data ) { // store access_token in local storage

          Usergrid.user = data.user;
          localStorage.setItem("username", loginData.username );
          localStorage.setItem("access_token", data.access_token );

          this.set("username", ""); // clear the form
          this.set("password", "");

          this.get("target").send("onLogin"); // call route to handle transition
        }
      });
    }

  }
});


App.LoginRoute = Ember.Route.extend({
  actions: {
    onLogin : function() {
      this.transitionTo("/");
    }
  }
});


//------------------------------------------------------------------------------
// Add Checnkin

App.AddCheckinController = Ember.Controller.extend({

  actions: {

    checkin: function() {

      var content = this.get("content");
      var location = this.get("location");
      var target = this.get("target");

      var activity = this.store.createRecord( "NewActivity", {
        content: content,
        location: location,
        verb: "checkin",
        actor: {
          username: Usergrid.user.username
        }
      });

      activity.save().then(
        function( success ) { 
          //alert("Saved"); 
          target.send("onCheckinDone"); // call route to handle transition
        },
        function( error ) { 
          alert("Error " + error.responseJSON.error_description); 
        }
      ); 

    }
  }

});


App.AddCheckinRoute = Ember.Route.extend({
  actions: {
    onCheckinDone: function() {
      this.transitionTo("/");
    }
  }
});
