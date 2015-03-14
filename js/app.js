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

// Example illustrates Usergrid login via Ember and without Usergrid JavaScript SDK


UG.Config.setProperties({
  orgName: "snoopdave",
  appName: "foodsite",
  url: "https://api.usergrid.com"
});


App = Ember.Application.create();

App.Router.map(function() {
  this.route("login",    { path: "/login" });
  this.route("logout",   { path: "/logout" });
  this.route("register", { path: "/register" });
});


//------------------------------------------------------------------------------
// Setup Ember-Data And Ember-Usergrid


App.ApplicationAdapter = UG.RESTAdapter.extend();

App.ApplicationSerializer = UG.RESTSerializer.extend();

App.ApplicationStore = DS.Store.extend({
  adapter: App.ApplicationAdapter.create() 
});

App.store = App.ApplicationStore.create();

App.FoodsiteSerializer = UG.RESTSerializer.extend( DS.EmbeddedRecordsMixin, {
  attrs: {
    location: { embedded: 'always' }
  }
});


//------------------------------------------------------------------------------
// Define models for each Usergrid Entity type needed for this app

App.User = UG.User.extend();

App.Foodsite = UG.Entity.extend({
  name: DS.attr("string"),
  location: DS.belongsTo("location")
  //uuid: DS.attr("string"),
  //type: DS.attr("string"),
  //tag_line: DS.attr("string"),
  //about: DS.attr("string"),
  //hours: DS.attr("string"),
  //directions: DS.attr("string"),
  //street_address: DS.attr("string"),
  //city: DS.attr("string"),
  //state: DS.attr("string"),
  //post_code: DS.attr("string")
});

App.Location = DS.Model.extend({
  latitude: DS.attr("number"),
  longitude: DS.attr("number")
});

App.Menu = DS.Model.extend({
  uuid: DS.attr("string"),
  type: DS.attr("string")
});

App.MenuItem = DS.Model.extend({
  uuid: DS.attr("string"),
  type: DS.attr("string")
});


//------------------------------------------------------------------------------
// Index page route


App.IndexRoute = Ember.Route.extend({

  loggedIn: function() {
    return localStorage.getItem("username") && localStorage.getItem("access_token");
  },

  beforeModel: function() {

    // check to see it we are logged in
    if ( this.loggedIn() ) {

      var username =localStorage.getItem("username");
      var accessToken =localStorage.getItem("access_token");
      UG.Auth.validateToken( accessToken, username, {
          context: this,
          error: function() {
            // hmm, token must have expired, need to login
            localStorage.removeItem("username");
            localStorage.removeItem("access_token");
            this.context.transitionTo("login");
          },
          success: function( data ) {} // yay!
      });

    } else {
      // no token, user must login
      this.transitionTo("login");
    } 
  },

  model: function() {
    if ( this.loggedIn() ) {
      var foodsite = this.store.find("foodsite");
      if ( foodsite.length > 0 ) {
          return foodsite[0];
      }
      return {};
    }
    return {};
  },

  actions: {
    login: function() {
      this.transitionTo("login");
    },
    logout: function() {
      alert("Logout");
    }

  }

});


//------------------------------------------------------------------------------
// Index page controller


App.IndexController = Ember.Controller.extend({

  actions: {

    logout: function () {
      UG.Auth.logout();
      localStorage.removeItem("username");
      localStorage.removeItem("access_token");
      this.get("target").send("login");
    },

    save: function () {

      var name = this.get("display_name");
      var lat = parseInt( this.get("latitude") );
      var lon = parseInt( this.get("longitude") );

      var location = this.store.push("location", {
        id: "foo",
        longitude: lon,
        latitude: lat
      });

      var fs = this.store.createRecord("foodsite", {
        name: name
      });

      fs.set("location", location);

      fs.save().then(
          function (success) {
            alert("Saved");
          },
          function (error) {
            alert("Error " + error);
          }
      );
    }
  }

});

// date formatting using pattern discussed here:
// http://emberjs.com/guides/cookbook/user_interface_and_interaction/displaying_formatted_dates_with_moment_js/
//Ember.Handlebars.registerBoundHelper('formatDate', function(format, date) {
//  return moment(date).format(format);
//});


//------------------------------------------------------------------------------
// Login page


App.LoginController = Ember.Controller.extend({

  actions: {

    login: function() { // login by POST to /token end-point

      UG.Auth.login( this.get("username"), this.get("password"), {
        context: this,
        error: function( message ) {
          alert( message );
        },
        success: function( data ) { // store access_token in local storage
          localStorage.setItem("username", data.user.username );
          localStorage.setItem("access_token", data.access_token );
          this.context.set("username", ""); // clear the form
          this.context.set("password", "");
          this.context.get("target").send("onLogin"); // call route to handle transition
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
      this.transitionTo("/");
    }
  }
});


//------------------------------------------------------------------------------
// Register page

App.RegisterController = Ember.Controller.extend({

  actions: {

    register: function () {

      var username = this.get("username");
      var email = this.get("email");
      var password = this.get("password");
      var password_confirm = this.get("password_confirm");

      if (password === password_confirm) {

        // TODO: is this necessary?
        var route = this;
        var model = this;

        UG.Auth.register( this.store, username, email, password, {
          success: function (success) {
            model.set("username", "");
            model.set("email", "");
            model.set("password", "");
            model.set("password_confirm", "");
            alert("Welcome! Please login to your new account.");
            route.transitionToRoute("/login")
          },
          error: function (error) {
            alert("Error " + error.responseJSON.error_description);
          }
        });

      } else {
        alert("Password confirm does not match password");
      }
    },

    updateUsername: function() {
      var username = this.get("username");
      if ( username && username.length > 3 ) {
        this.set("usernameValid", true);
      } else {
        this.set("usernameValid", false);
      }
      this.set("formInvalid",
        !(this.get("usernameValid") && this.get("emailValid") && this.get("passwordValid")));
    },

    updateEmail: function() {
      var email = this.get("email");

      if ( email && email.length > 3 && emailRegex.test(email) ) {
        this.set("emailValid", true);
      } else {
        this.set("emailValid", false);
      }

      this.set("formInvalid",
        !(this.get("usernameValid") && this.get("emailValid") && this.get("passwordValid")));
    },

    updatePassword: function() {
      var password = this.get("password");
      var password_confirm = this.get("password_confirm");
      if ( password && password.length > 3 && password_confirm == password ) {
        this.set("passwordValid", true);
      } else {
        this.set("passwordValid", false);
      }
      this.set("formInvalid",
        !(this.get("usernameValid") && this.get("emailValid") && this.get("passwordValid")));
    }
  }
});


//------------------------------------------------------------------------------
// Modal dialogs

//App.ApplicationRoute = Ember.Route.extend({
//
//  actions: {
//    showModal: function(name, model) {
//      this.render(name, {
//        into: "application",
//        outlet: "modal",
//        model: model
//      });
//    },
//
//    removeModal: function() {
//      this.disconnectOutlet({
//        outlet: "modal",
//        parentView: "application"
//      });
//    }
//  }
//
//});
//
//App.ModalDialogComponent = Ember.Component.extend({
//
//  actions: {
//    ok: function() {
//      this.$(".modal").modal("hide");
//      var inputs = {};
//      this.$("input").each( function( idx, elem ) {
//          inputs[elem.name] = elem.value;
//      } );
//      this.sendAction("ok", inputs);
//    }
//  },
//
//  show: function() {
//    this.$(".modal").modal().on("hidden.bs.modal", function() {
//      this.sendAction("close");
//    }.bind(this));
//  }.on("didInsertElement")
//
//});
