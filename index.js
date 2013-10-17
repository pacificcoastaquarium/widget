var domready  = require('domready');
var Auth0     = require('auth0-js');
var qwery     = require('qwery');
var bonzo     = require('bonzo');
var bean      = require('bean');
var fs        = require('fs');
var insertCss = require('insert-css');

var loginTmpl = require('./widget/html/login.html');

domready(function () {
  var options = {
    domain:      'mdocs.auth0.com',
    clientID:    '0HP71GSd6PuoRYJ3DXKdiXCUUdGmBbup', 
    callbackURL: 'http://localhost:3000/'
  };

  var auth0 = Auth0({
    clientID:     options.clientID, 
    callbackURL:  options.callbackURL,
    domain:       options.domain
  });

  var _strategies = {
      'google-openid': { css: 'google', name: 'Google OpenId', social: true },
      'google-apps': { css: 'google', name: 'Google Apps', social: false },
      'google-oauth2': { css: 'googleplus', name: 'Google', social: true },
      'facebook': { css: 'facebook', name: 'Facebook', social: true },
      'windowslive': { css: 'windows', name: 'Microsoft Account', social: true },
      'linkedin': { css: 'linkedin', name: 'LinkedIn', social: true },
      'github': { css: 'github', name: 'GitHub', social: true },
      'paypal': { css: 'paypal', name: 'PayPal', social: true },
      'twitter': { css: 'twitter', name: 'Twitter', social: true },
      'amazon': { css: 'amazon', name: 'Amazon', social: true },
      'vkontakte': { css: 'vk', name: 'vKontakte', social: true },
      'yandex': { css: 'yandex', name: 'Yandex', social: true },
      'office365': { css: 'office365', name: 'Office365', social: false },
      'waad': { css: 'waad', name: 'Windows Azure AD', social: false },
      'adfs': { css: 'windows', name: 'ADFS', social: false },
      'samlp': { css: 'guest', name: 'SAML', social: false },
      'ad': { css: 'windows', name: 'AD / LDAP', social: false },
      'custom': { css: 'guest', name: 'Custom Auth', social: false },
      'auth0': { css: 'guest', name: 'Auth0', social: false },
      'auth0-adldap': { css: 'guest', name: 'AD/LDAP', social: false },
      'thirtysevensignals': { css: 'thirtysevensignals', name: '37 Signals', social: true },
      'box': { css: 'box', name: 'Box', social: true, imageicon: true },
      'salesforce': { css: 'salesforce', name: 'Salesforce', social: true },
      'fitbit': { css: 'fitbit', name: 'Fitbit', social: true }
  };

  var _auth0Strategy, _auth0ConnectionParams, _hasLoggedInBefore;
  var _client = {
    strategies: [
      {
        name: 'google-oauth2',
        social: true,
        connections: [
          { domain: '', name: 'google-oauth2' }
        ]
      },
      {
        name: 'github',
        social: true,
        connections: [
          { domain: '', name: 'github' }
        ]
      },
      {
        name: 'auth0',
        connections: [
          { domain: '', name: 'Username-Password-Authentication' }
        ]
      }
    ]
  };

  // helper methods
  var $ = function (selector, root) {
    return bonzo(qwery(selector, root));
  };

  var _redirect = function (url) {
    global.window.location = url;
  };

  var _setTop = function (onTop, element) {
    if (!onTop) {
      setTimeout(function() {
        element.css({
          'marginTop': '-' + (element.offset().height / 2) + 'px',
          'top': '50%'
        });
      }, 1);
    } else {
      element.css({
        'marginTop': '2px',
        'top': '0'
      });
    }
  };

  var _showError = function (error) {
    $('.signin h1').css('display', 'none');
    $('.signin .success').css('display', 'none');
    $('.signin .error').html(error).css('display', '');
  };

  var _showSuccess = function (message) {
    $('.signin h1').css('display', 'none');
    $('.signin .error').css('display', 'none');
    $('.signin .success').html(message).css('display', '');
  };

  var _isAuth0Conn = function (strategy) {
    return strategy === 'auth0' || strategy === 'auth0-adldap';
  };

  var _setTitle = function(title) {
    $('.signin .error').css('display', 'none');
    $('.signin .success').css('display', 'none');
    $('.signin h1').html(title).css('display', '');
  };

  var _isAdLdapConn = function (connection) {
    return connection === 'adldap';
  };

  var _areThereAnySocialConn = function () {
    for (var s in _client.strategies) {
      if (_strategies[_client.strategies[s].name] && _strategies[_client.strategies[s].name].social) {
        return true;
      }
    }

    return false;
  };

  var _areThereAnyEnterpriseOrDbConn = function() {
    for (var s in _client.strategies) {
      if (_strategies[_client.strategies[s].name] && 
          !_strategies[_client.strategies[s].name].social) {
        return true;
      }
    }

    return false;
  };

  var _getConfiguredStrategy = function (name) {
    for (var s in _client.strategies) {
      if (_client.strategies[s] && _client.strategies[s].name === name) {
        return _client.strategies[s];
      }
    }
  };

  var _getAuth0Connection = function() {
    // if specified, use it, otherwise return first
    if (options['userPwdConnectionName']) {
      for (var i in _auth0Strategy.connections) {
        if (_auth0Strategy.connections[i].name === options['userPwdConnectionName']) {
          return _auth0Strategy.connections[i];
        }
      }
    }

    return _auth0Strategy ? _auth0Strategy.connections[0] : null;
  };

  var _hideSignIn = function (cb) {
    $('div.overlay').removeClass('active');
    setTimeout(function () {
      $('html').removeClass('mode-signin');
      if (cb) cb();
    }, 500);
  };

  var _getActiveLoginView = function() {
    var container = _hasLoggedInBefore ? $('.loggedin') : $('.notloggedin');
    return container;
  };

  var _toggleSpinner = function (container) {
    container = container || _getActiveLoginView();
    var spinner = $('.spinner', container);
    var signin = $('.zocial.primary', container);

    spinner.css('display', spinner.css('display') === 'none' ? '' : 'none');
    signin.css('display', signin.css('display') === 'none' ? '' : 'none');
  };

  var _setLoginView = function(opts) {
    _hasLoggedInBefore = opts.isReturningUser;
    _setTitle(options['title']);

    $('.loggedin').css('display', 'none');
    $('.notloggedin').css('display', 'none');
    $('.signup').css('display', 'none');
    $('.reset').css('display', 'none');

    $('.loggedin').css('display', opts.isReturningUser ? '' : 'none');
    $('.notloggedin').css('display', opts.isReturningUser ? 'none' : '');

    _setTop(options.top, $('.signin div.panel.onestep'));
    $('.notloggedin .email input').first().focus();
  };

  var _showLoggedInExperience = function() {
    var strategy = _cookies.signin.strategy;
    _setLoginView({ isReturningUser: !!strategy });

    if (!strategy) return;

    var loginView = _getActiveLoginView();
    bean.on($('form', loginView)[0], 'submit', _signInEnterprise);
    
    var button;
    if (strategy !== 'auth0') {
      button = bonzo('<span></span>')
            .attr('tabindex', 0)
            .attr('data-strategy', strategy)
            .attr('title', _strategies[strategy].name)
            .addClass('zocial').addClass('block')
            .addClass(_strategies[strategy].css)
            .addClass(_strategies[strategy].imageicon ? 'image-icon' : '');
            //.html(global.tlite.find("{name}", { name: _strategies[strategy].name}));
      
      bean.on(button, 'click', _showSignInOptions(e.target));

      $('.strategy span', loginView).each(function (el) { if (el) el.remove(); });
      $('.strategy', loginView).append(button);
    }

    $('.all', loginView).html(options['allButtonTemplate']);

    bean.on($('.all', loginView), 'click', function () {
      _setLoginView({ isReturningUser: false });
    });

    if (_cookies.signin.email) {
      if (strategy === 'auth0') {
        $('.email-readonly', loginView).html(_cookies.signin.email); 
        $('.email input', loginView).css('display', 'none');
        $('.emailPassword', loginView).css('display', '');
      } 
      else if (_isEnterprise(strategy)) {
        button.html(_cookies.signin.email || _strategies[strategy].name)
              .attr('title', _cookies.signin.email || _strategies[strategy].name);
      }
    }
  };

  var _signInSocial = function (target) {
    var strategyName = typeof target === 'string' ? target : target.getAttribute('data-strategy');
    var strategy = _getConfiguredStrategy(strategyName);

    if (strategy) {
      auth0.login({
        connection: strategy.connections[0].name
      });
    }
  };

  var _signInEnterprise = function (e) {
    e.preventDefault();
    e.stopPropagation();

    var container = _getActiveLoginView();
    var form = $('form', container);
    var valid = true;

    var emailD = $('.email', form),
        emailE = $('input[name=email]', form),
        emailM = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.exec(emailE.val().toLowerCase()),
        emailP = /^\s*$/.test(emailE.val()),
        domain, url, email = null, strategy;

    for (var s in _client.strategies) {
      strategy = _client.strategies[s];

      if (_isAuth0Conn(strategy.name)) continue;

      for (var c in strategy.connections) {
        if(!emailP && emailM && emailM.slice(-2)[0] == strategy.connections[c].domain) {
          domain = strategy.connections[c].domain;
          url = strategy.connections[c].url;
          email = emailE.val();
          break;
        }
      }

      if (domain) break;
    }

    if (emailP) {
      // _showError(global.tlite.find(self._signInOptions['strategyEmailEmpty']));
    } 
    else if (!emailM) {
      // _showError(global.tlite.find(self._signInOptions['strategyEmailInvalid']));
    } 
    else if (!domain) {
      if (_auth0Strategy) {
        return _signInWithAuth0(emailE.val());
      }

      if (emailM && emailM.slice(-2)[0] === 'gmail.com') {
        return _signInSocial('google-oauth2');
      }

      // _showError(global.tlite.find(self._signInOptions['strategyDomainInvalid'], { domain: emailM && emailM.slice(-2)[0] }));
    }

    valid &= (!domain && !emailD.addClass('invalid')) || (!!domain && !!emailD.removeClass('invalid'));

    if (valid) {
      _redirect(url);
    }
  };

  var _signInWithAuth0 = function (userName, signInPassword) {
    _toggleSpinner();

    var container = _getActiveLoginView();
    var connection  = _getAuth0Connection();
    
    var loginOptions = {
      connection: connection.name,
      username: _isAdLdapConn(connection.name) ? userName.replace('@' + connection.domain, '') : userName,
      password: signInPassword || $('.password input', container).val()
    };

    for (var k in _auth0ConnectionParams) {
      loginOptions[k] = _auth0ConnectionParams[k];
    }

    auth0.login(loginOptions, function (err) {
      if (err) alert(err);
      _toggleSpinner();
    });
  };

  // initialize
  var initialize = function () {
    // TODO: support css option for non free subscriptions

    bean.on($('.popup .panel.onestep a.close')[0], 'click', _hideSignIn);
    bean.on($('.popup .panel.onestep .notloggedin form')[0], 'submit', _signInEnterprise);
    bean.on($('html')[0], 'keyup', function (e) {
      if ($('html').hasClass('mode-signin')) {
        if ((e.which == 27 || e.keycode == 27) && !options.standalone) {
          _hideSignIn(); // close popup with ESC key
        }
      }
    });

    // load social buttons
    var list = $('.popup .panel.onestep .iconlist');
    for (var s in _client.strategies) {
      var strategy = _client.strategies[s];

      if (_isAuth0Conn(strategy.name) && strategy.connections.length > 0) {
        _auth0Strategy = strategy;
        $('.create-account, .password').css('display', 'block');
      }

      if (_strategies[strategy.name] && _strategies[strategy.name].social) {
        var button = bonzo(bonzo.create('<span></span>'))
          .attr('tabindex', 0)
          .attr('data-strategy', strategy.name)
          .attr('title', _strategies[strategy.name].name)
          .addClass('zocial').addClass('icon')
          .addClass(_strategies[strategy.name].css)
          .addClass(_strategies[strategy.name].imageicon ? 'image-icon' : '');
          //.html(global.tlite.find("{name}", { name: _strategies[strategy.name].name}));

        list.append(button);
        list.css('display', 'block');

        $('.popup .panel.onestep .separator').css('display', 'block');
      }
    }

    $('.popup .panel.onestep .iconlist span').each(function (button) {
      bean.on(button, 'click', function (e) {
        _signInSocial(e.target);
      });
    });

    showSignIn();
  };

  var showSignIn = function () {
    $('html').addClass('mode-signin');

    // if no social connections and one enterprise connection only, redirect
    if (!_areThereAnySocialConn() && 
      _client.strategies.length === 1 &&
      _client.strategies[0].name !== 'auth0' &&
      _client.strategies[0].connections.length === 1) {
      
      _redirect(_client.strategies[0].connections[0].url);
    }

    // labels text
    options = options || {};
    options['onestep'] = typeof options['onestep'] !== 'undefined' ? options['onestep'] : false;
    options['top'] = options['top'] || false;
    options['title'] = options['title'] || 'Sign In';
    options['strategyButtonTemplate'] = options['strategyButtonTemplate'] || "{name}";
    options['allButtonTemplate'] = options['allButtonTemplate'] || "Show all";
    options['strategyBack'] = options['strategyBack'] || "Back";
    options['strategyEmailLabel'] = options['strategyEmailLabel'] || "Email:";
    options['strategyEmailEmpty'] = options['strategyEmailEmpty'] || "The email is empty.";
    options['strategyEmailInvalid'] = options['strategyEmailInvalid'] || "The email is invalid.";

    options['icon'] = options['icon'] || "img/logo-32.png";
    options['showIcon'] = typeof options['showIcon'] !== 'undefined' ? options['showIcon'] : false;
    options['showSignup'] = typeof options['showSignup'] !== 'undefined' ? options['showSignup'] : true;
    options['showForgot'] = typeof options['showForgot'] !== 'undefined' ? options['showForgot'] : true;
    options['signupText'] = options['signupText'] || 'Sign Up';
    options['forgotText'] = options['forgotText'] || 'Forgot your password?';
    options['useAppSignInCallback'] = typeof options['useAppSignInCallback'] !== 'undefined' ? options['useAppSignInCallback'] : false;
    options['signInButtonText'] = options['signInButtonText'] || 'Sign In';
    options['emailPlaceholder'] = options['emailPlaceholder'] || 'Email';
    options['passwordPlaceholder'] = options['passwordPlaceholder'] || 'Password';
    options['separatorText'] = options['separatorText'] || 'or';
    options['serverErrorText'] = options['serverErrorText'] || 'There was an error processing the sign in.';
    options['showEmail'] = typeof options['showEmail'] !== 'undefined' ? options['showEmail'] : true;
    options['showPassword'] = typeof options['showPassword'] !== 'undefined' ? options['showPassword'] : true;
    options['socialBigButtons'] = typeof options['socialBigButtons'] !== 'undefined' ? options['socialBigButtons'] : !_areThereAnyEnterpriseOrDbConn();
    options['enableReturnUserExperience'] = typeof options['enableReturnUserExperience'] !== 'undefined' ? options['enableReturnUserExperience'] : true;
    options['returnUserLabel'] = options['returnUserLabel'] || 'Last time you signed in using...';
    options['wrongEmailPasswordErrorText'] = options['wrongEmailPasswordErrorText'] || 'Wrong email or password.';

    // theme
    if (options.theme) {
      $('html').addClass('theme-' + options.theme);
    }

    $('.panel a.close').css('display', options.standalone ? 'none' : 'block');

    // show icon
    if (options.showIcon) {
      $('.panel .image img').attr('src', options.icon);
      $('.panel .image').css('display', options.showIcon ? 'block' : 'none');
    }

    // hide divider dot if there are one of two
    $('.panel .create-account .divider')
      .css('display', options.showEmail && options.showSignup && options.showForgot ? '' : 'none');

    $('div.panel input').each(function (e) { e.value = ''; });

    // placeholders and buttons
    $('.panel .zocial.primary').html(options.signInButtonText);
    $('.panel .email input').attr('placeholder', options.emailPlaceholder);
    $('.panel .password input').attr('placeholder', options.passwordPlaceholder);
    $('.panel .separator span').html(options.separatorText);

    // show email, password, separator and button if there are enterprise/db connections
    var anyEnterpriseOrDbConnection = _areThereAnyEnterpriseOrDbConn();
    var anySocialConnection = _areThereAnySocialConn();

    $('.panel .email input').css('display', options.showEmail && anyEnterpriseOrDbConnection ? '' : 'none');
    $('.panel .zocial.primary').css('display', options.showEmail && anyEnterpriseOrDbConnection ? '' : 'none');
    $('.panel .password input').css('display', options.showEmail && options.showPassword && anyEnterpriseOrDbConnection ? '' : 'none');
    $('.panel .create-account .forgot-pass').css('display', options.showEmail && options.showForgot && anyEnterpriseOrDbConnection ? '' : 'none');
    $('.panel .create-account .sign-up').css('display', options.showEmail && options.showSignup && anyEnterpriseOrDbConnection ? '' : 'none');
    $('.panel .separator').css('display', options.showEmail && anyEnterpriseOrDbConnection && anySocialConnection ? '' : 'none');
    $('.panel .last-time').html(options.returnUserLabel);

    // TODO: show placeholders for IE9

    // activate panel
    $('div.panel').removeClass('active');
    $('div.overlay').addClass('active');
    $('div.panel.onestep').addClass('active');

    $('.popup h1').html(options.title);
    $('.popup .invalid').removeClass('invalid');

    // if user logged in show logged in experience
    /* if (_cookies.signin && options['enableReturnUserExperience']) {
      _showLoggedInExperience();
    } */

    if (options['socialBigButtons']) {
      $('.popup .panel.onestep .iconlist span').removeClass('icon').addClass('block');
    } else {
      $('.popup .panel.onestep .iconlist span').addClass('icon').removeClass('block');
    }

    $('div.panel.onestep h1').html(options['title']);
    $('div.panel.onestep').addClass('active');

    _setTop(options.top, $('div.panel.onestep'));

    /* if (_cookies.signin && _cookies.signin.email) {
      $('div.panel.onestep input').set('value', _cookies.signin.email);
    } */

    _setLoginView({ isReturningUser: false });
  };

  // load
  insertCss(fs.readFileSync(__dirname + '/widget/css/login.css'));
  insertCss(fs.readFileSync(__dirname + '/widget/css/zocial.css'));
  insertCss(fs.readFileSync(__dirname + '/widget/css/common.css'));
  insertCss(fs.readFileSync(__dirname + '/widget/css/button.css'));
  insertCss(fs.readFileSync(__dirname + '/widget/css/normalize.css'));

  var div = document.createElement('div');
  div.innerHTML = loginTmpl({});

  document.body.appendChild(div);

  initialize();
});