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
  this.route("register", { path: "/register" });
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

Ember.ObjectController.extend(Ember.Validations.Mixin, {});


//------------------------------------------------------------------------------
// Setup Ember-Data 

App.ApplicationAdapter = DS.RESTAdapter.extend({

  host: Usergrid.getAppUrl(),

  headers: function() { 
    if ( localStorage.getItem("access_token") ) {
      return { "Authorization": "Bearer " + localStorage.getItem("access_token") }; 
    } 
    return {};
  }.property().volatile(), // ensure value not cached

  pathForType: function(type) {
    var ret = Ember.String.camelize(type);
    ret = Ember.String.pluralize(ret);

    if ( ret == "newActivities" ) {
      // Must have a special logic here for new activity because new Activities 
      // must be posted to the path /{org}/{app}/users/activities, instead of the
      // path /{org}/{app}/activities as Ember-Data expects.
      ret = "/users/" + Usergrid.user.username + "/activities";
    }
    return ret;
  }

});

App.ApplicationStore = DS.Store.extend({
  adapter: App.ApplicationAdapter.create() 
});

App.store = App.ApplicationStore.create();


// Must extend REST serializer to handle Usergrid JSON format, which is 
// different from what Ember-Data expects.
App.ApplicationSerializer = DS.RESTSerializer.extend({

  // Extract Ember-Data array from Usergrid response
  extractArray: function(store, type, payload) {

    // Difference: Usergrid does not return wrapper object with type-key
    // 
    // Ember-Data expects a JSON wrapper object around the results with a single
    // field that is also the type of the data being returned. Usergrid returns 
    // a JSON objects with lots of fields, with an array field named 'entities' 
    // that contains the Usergrid Entities returned.
    //
    // So here we grab the Usergrid Entities and stick them under a type-key
    var typeKey = payload.path.substring(1);
    payload[ typeKey ] = payload.entities;

    // Difference: Usergrid returns ID in 'uuid' field, Ember-Data expects 'id'
    // So here we add an 'id' field for each Entity, with its 'uuid' value.
    for ( var i in payload.entities ) {
      if ( payload.entities[i] && payload.entities[i].uuid ) {
        payload.entities[i].id = payload.entities[i].uuid;
      }
    }

    return this._super(store, type, payload);
  },

  // Serialize Ember-Data object to Usergrid compatible JSON format
  serializeIntoHash: function( hash, type, record, options ) {

    // Usergrid does not expect a type-key
    record.eachAttribute(function( name, meta ) {
      hash[name] = record.get(name);
    });

    return hash;
  },
});

// Define models for each Usergrid Entity type needed for this app

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

// Must have a special model for new activity because new Activities must 
// be posted to the path /{org}/{app}/users/activities, instead of the
// path /{org}/{app}/activities as Ember-Data expects.
App.NewActivity = DS.Model.extend({
  content: DS.attr('string'),
  location: DS.attr('string'),
  actor: DS.attr('string'),
  verb: DS.attr('string')
});

App.User = DS.Model.extend({
  name: DS.attr('string'),
  username: DS.attr('string'),
  email: DS.attr('string'),
  password: DS.attr('string')
});


//------------------------------------------------------------------------------
// Application route for handling modals

App.ApplicationRoute = Ember.Route.extend({

  actions: {
    showModal: function(name, model) {
      this.render(name, {
        into: 'application',
        outlet: 'modal',
        model: model
      });
    },

    removeModal: function() {
      this.disconnectOutlet({
        outlet: 'modal',
        parentView: 'application'
      });
    }
  }

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

    logout: function() {
      Usergrid.user = null;
      localStorage.removeItem("username");
      localStorage.removeItem("access_token"); 
      this.get("target").send("login");
    }
  }
});


//------------------------------------------------------------------------------
// Login  page

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
    },

    register: function() {
      this.transitionToRoute("register");
    }

  }
});


App.LoginRoute = Ember.Route.extend({
  actions: {
    onLogin : function() {
      this.transitionToRoute("/");
    }
  }
});


//------------------------------------------------------------------------------
// Register page

App.RegisterController = Ember.Controller.extend({
  actions: {

    register: function() { 

      var password = this.get("password");
      var password_confirm = this.get("password_confirm");

      if (password === password_confirm) {

        var user = this.store.createRecord( "User", {
            name: this.get("username"), 
            email: this.get("email"), 
            password: this.get("password")
        });

        var route = this; // TODO: is this necessary?

        user.save().then(
          function( success ) { 
              alert("Welcome! Please login to your new account."); 
              route.transitionToRoute("/login")
            },
          function( error ) { 
              alert("Error " + error.responseJSON.error_description); 
          }
        ); 

      } else {
          alert("Password confirm does not match password");
      }
    }
  }
});


App.RegisterRoute = Ember.Route.extend({
  actions: {
    onRegister : function() {
      this.transitionToRoute("/");
    }
  }
});


//------------------------------------------------------------------------------
// Add Checnkin

App.AddCheckinModalController = Ember.ObjectController.extend({

  actions: {

    save: function( inputs ) {

      var content = inputs.content;
      var location = inputs.location;
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
          alert("Saved"); 
        },
        function( error ) { 
          alert("Error " + error.responseJSON.error_description); 
        }
      ); 

    } 
  }
});


App.ModalDialogComponent = Ember.Component.extend({

  actions: {
    ok: function() {
      this.$('.modal').modal('hide');
      var inputs = {};
      this.$('input').each( function( idx, elem ) {
          inputs[elem.name] = elem.value;
      } );
      this.sendAction('ok', inputs);
    }
  },
  show: function() {
    this.$('.modal').modal().on('hidden.bs.modal', function() {
      this.sendAction('close');
    }.bind(this));
  }.on('didInsertElement')

});
