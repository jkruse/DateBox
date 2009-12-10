/**
 * 'DateBox' object - by Jakob Kruse <kruse@kruse-net.dk>
 * For easy date entry into form input elements.
 *
 * Based on:
 *
 *   A rewrite by Will Rickards (2005-02-04) of
 *
 *   'Magic' date parsing, by Simon Willison (6th October 2003)
 *   http://simon.incutio.com/archive/2003/10/06/betterDateInput
 *
 * New in this version:
 *
 *   - Fixed a few bugs.
 *   - Translated output to danish.
 *   - Modified for Europe (defaults to european format, not american).
 *
 * Usage:
 *
 *   DateBox.register(obj);
 *
 *   Where 'obj' is an input element with type of text.
 *   A span will be created dynamically after the input box.
 *   The span will use the CSS classes: DateBoxControlMsg, DateBoxControlErrorMsg.
 *   This span will contain either a nicely formatted date (locale dependant),
 *   or an error message if the contents of the input can't be parsed.
 *
 * History:
 *
 *   1.4 - some date formats gave errors in Mozilla, now fixed.
 *         added mouse wheel scroll handling.
 *   1.3 - empty input no longer shows "Ukendt dato format".
 *   1.2 - added a few new formats.
 *
 * $Id: DateBox.js,v 1.3 2006/01/20 07:50:14 Jakob Kruse Exp $
 */

// Validate presence of extensions
if (!([].indexOf && [].filter)) throw('Array extensions not loaded!');
if (!("".right && "".trim)) throw('String extensions not loaded!');

var DateBox = {
  monthNames : "januar februar marts april maj juni juli august september oktober november december".split(" "),
  weekdayNames : "søndag mandag tirsdag onsdag torsdag fredag lørdag".split(" "),

  // Array of objects, each has 're', a regular expression and 'handler', a 
  // function for creating a date from something that matches the regular 
  // expression. Handlers may throw errors if string is unparseable. 
  dateParsePatterns : [
    // I dag
    {   re: /^i ?d/i,
        handler: function() {
          return new Date();
        }
    },
    // I morgen
    {   re: /^i ?m/i,
        handler: function() {
          var d = new Date();
          d.setDate(d.getDate() + 1);
          return d;
        }
    },
    // I går
    {   re: /^i ?g/i,
        handler: function() {
          var d = new Date();
          d.setDate(d.getDate() - 1);
          return d;
        }
    },
    // 4.
    {   re: /^(\d{1,2})\.?$/i,
        handler: function(bits) {
          var d = new Date();
          var yyyy = d.getFullYear();
          var dd = parseInt(bits[1], 10);
          var mm = d.getMonth();

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // 4. jan
    {   re: /^(\d{1,2})\.? (\w+)$/i,
        handler: function(bits) {
          var d = new Date();
          var yyyy = d.getFullYear();
          var dd = parseInt(bits[1], 10);
          var mm = DateBox.parseMonth(bits[2]);

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // 4. jan 2003
    {   re: /^(\d{1,2})\.? (\w+),? (\d{4})$/i,
        handler: function(bits) {
          var yyyy = parseInt(bits[3], 10);
          var dd = parseInt(bits[1], 10);
          var mm = DateBox.parseMonth(bits[2]);

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // jan 4
    {   re: /^(\w+) (\d{1,2})\.?$/i, 
        handler: function(bits) {
          var d = new Date();
          var yyyy = d.getFullYear(); 
          var dd = parseInt(bits[2], 10);
          var mm = DateBox.parseMonth(bits[1]);

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // jan 4 2003
    {   re: /^(\w+) (\d{1,2})[\.,]? (\d{4})$/i,
        handler: function(bits) {
          var yyyy = parseInt(bits[3], 10); 
          var dd = parseInt(bits[2], 10);
          var mm = DateBox.parseMonth(bits[1]);

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // næste tirsdag - this is suspect due to weird meaning of "næste"
    {   re: /^næste (\w+)$/i,
        handler: function(bits) {
          var d = new Date();
          var day = d.getDay();
          var newDay = DateBox.parseWeekday(bits[1]);
          var addDays = newDay - day;
          if (newDay <= day) {
            addDays += 7;
          }
          d.setDate(d.getDate() + addDays);
          return d;
        }
    },
    // sidste tirsdag
    {   re: /^sidste (\w+)$/i,
        handler: function(bits) {
          var d = new Date();
          var wd = d.getDay();
          var nwd = DateBox.parseWeekday(bits[1]);

          // determine the number of days to subtract to get last weekday
          var addDays = (-1 * (wd + 7 - nwd)) % 7;

          // above calculate 0 if weekdays are the same so we have to change this to 7
          if (0 == addDays)
          addDays = -7;

          // adjust date and return
          d.setDate(d.getDate() + addDays);
          return d;
        }
    },
    // dd/mm/yyyy (European style)
    {   re: /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/,
        handler: function(bits) {
          var yyyy = parseInt(bits[3], 10);
          var dd = parseInt(bits[1], 10);
          var mm = parseInt(bits[2], 10) - 1;

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // dd/mm/yy (European style) short year
    {   re: /(\d{1,2})\/(\d{1,2})\/(\d{2})/,
        handler: function(bits) {
          var d = new Date();
          var yyyy = d.getFullYear() - (d.getFullYear() % 100) + parseInt(bits[3], 10);
          var dd = parseInt(bits[1], 10);
          var mm = parseInt(bits[2], 10) - 1;

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // dd/mm (European style) omitted year
    {   re: /(\d{1,2})\/(\d{1,2})/,
        handler: function(bits) {
          var d = new Date();
          var yyyy = d.getFullYear();
          var dd = parseInt(bits[1], 10);
          var mm = parseInt(bits[2], 10) - 1;

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // yyyy-mm-dd (ISO style)
    {   re: /(\d{4})-(\d{1,2})-(\d{1,2})/,
        handler: function(bits) {
          var yyyy = parseInt(bits[1], 10);
          var dd = parseInt(bits[3], 10);
          var mm = parseInt(bits[2], 10) - 1;

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // yy-mm-dd (ISO style) short year
    {   re: /(\d{1,2})-(\d{1,2})-(\d{1,2})/,
        handler: function(bits) {
          var d = new Date();
          var yyyy = d.getFullYear() - (d.getFullYear() % 100) + parseInt(bits[1], 10);
          var dd = parseInt(bits[3], 10);
          var mm = parseInt(bits[2], 10) - 1;

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    },
    // mm-dd (ISO style) omitted year
    {   re: /(\d{1,2})-(\d{1,2})/,
        handler: function(bits) {
          var d = new Date();
          var yyyy = d.getFullYear();
          var dd = parseInt(bits[2], 10);
          var mm = parseInt(bits[1], 10) - 1;

          if (DateBox.dateIsValid(yyyy, mm, dd))
          return new Date(yyyy, mm, dd);
        }
    }
  ],

  register : function (obj) {
    if (obj) {
      // Add span after control for messages
      var oMsgSpan = document.createElement('span');
      oMsgSpan.className = 'DateBoxControlMsg';
      
      // If there is a next sibling...
      if (obj.nextSibling) {
        // ... insert before next sibling
        obj.parentNode.insertBefore(oMsgSpan, obj.nextSibling);
      } else {
        // ... else append child to parent
        obj.parentNode.appendChild(oMsgSpan);         
      }
      
      // Link message span to textbox for easy script access
      obj.message = oMsgSpan;
      
      // Validate current contents
      this.validate(obj);
      
      // hook up event handlers
      obj.onchange = function () { DateBox.validate(this); };
      obj.onkeydown = this.onKeyDown;
      if (obj.addEventListener) {
        obj.addEventListener("DOMMouseScroll", this.onMouseScroll, false);
      } else {
        obj.onmousewheel = this.onMouseScroll;
      }
    }
  },

  // Takes a string, returns the index of the month matching that string, throws an error if 0 or more than 1 matches
  parseMonth : function (month) {
    var matches = this.monthNames.filter(function(item) { return new RegExp("^" + month, "i").test(item); });
    if (matches.length == 0) {
      throw new Error("Ugyldig indtastning for månedsnavn");
    }
    if (matches.length > 1) {
      throw new Error("Ikke entydigt månedsnavn");
    }
    return this.monthNames.indexOf(matches[0]);
  },

  // Same as parseMonth but for days of the week
  parseWeekday : function (weekday) {
    var matches = this.weekdayNames.filter(function(item) { return new RegExp("^" + weekday, "i").test(item); });
    if (matches.length == 0) {
      throw new Error("Ugyldig indtastning for ugedag");
    }
    if (matches.length > 1) {
      throw new Error("Ikke entydig ugedag");
    }
    return this.weekdayNames.indexOf(matches[0]);
  },

  dateIsValid : function (yyyy, mm, dd) {
    // if month out of range
    if (mm < 0 || mm > 11)
      throw new Error('Ugyldig værdi for måned. Gyldige måneder er 1 til 12');
    
    // get last day in month
    var d = (11 == mm) ? new Date(yyyy + 1, 0, 0) : new Date(yyyy, mm + 1, 0);
    
    // if date out of range
    if (dd < 1 || dd > d.getDate())
      throw new Error('Ugyldig værdi for dag. Gyldige dage for ' + monthNames[mm] + ' er 1 til ' + d.getDate().toString());
    
    return true;
  },

  // Parses date string input
  parseDateString : function (strDateInput) {
    // cycle through date parse patterns
    for (var i = 0; i < this.dateParsePatterns.length; i++) {
      // get regular expression for this pattern
      var re = this.dateParsePatterns[i].re;
      
      // get handler function for this pattern
      var handler = this.dateParsePatterns[i].handler;
      
      // parse input using regular expression
      var bits = re.exec(strDateInput);
      
      // if there was a match
      if (bits) {
        // return the result of the handler function (which constitutes bits into a date)
        return handler(bits);
      }
    }
    // if no pattern matched - throw exception
    throw new Error("Ukendt dato-format");
  },
  
  // Creates date string output
  outputDateString : function (dDate) {
    return dDate.getFullYear().toString() + '-' + ('0' + (dDate.getMonth() + 1).toString()).right(2) + '-' + ('0' + dDate.getDate().toString()).right(2);
  },

  // Validates the input from datebox as a date
  validate : function (obj) {
    if (obj.value == '') {
      // Clear message span associated with textbox
      if (!obj.message.firstChild)
        obj.message.appendChild(document.createTextNode(''));
      else
        obj.message.firstChild.nodeValue = '';
      
      // remove class name
      obj.message.className = '';
      
      return;
    }
    
    try {
      // Parse input to get date (error is raised if it can't be parsed)
      var dtValue = this.parseDateString(obj.value.trim());
      
      // Assign date in default format to textbox
      obj.value = this.outputDateString(dtValue);
      
      // Add more formal date to message span associated with textbox
      if (!obj.message.firstChild)
        obj.message.appendChild(document.createTextNode(dtValue.toLocaleDateString()));
      else
        obj.message.firstChild.nodeValue = dtValue.toLocaleDateString();
      
      // swith class name back to default so styling is changed
      obj.message.className = 'DateBoxControlMsg';
    }
    catch (e) {
      // use error message from exception
      var strMessage = e.message;
      
      // give a nicer message to built-in javascript exception message
      if (strMessage.indexOf('is null or not an object') > -1)
      strMessage = 'Invalid date string';
      
      // add error message to message div associated with textbox
      if (!obj.message.firstChild)
        obj.message.appendChild(document.createTextNode(strMessage));
      else
        obj.message.firstChild.nodeValue = strMessage;
      
      // switch class name to error so styling is changed
      obj.message.className = 'DateBoxControlErrorMsg';
    }
  },

  onKeyDown : function (e) {
    if (!e) var e = window.event;
    var key = (e.which) ? e.which : e.keyCode;
    var input = this;

    if ("" != input.value) {
      switch (key) {
      case 38: // up
        var d = DateBox.parseDateString(input.value);
        d.setDate(d.getDate() + 1);
        input.value = DateBox.outputDateString(d);
        DateBox.validate(input);
        break;
      case 40: // down
        var d = DateBox.parseDateString(input.value);
        d.setDate(d.getDate() - 1);
        input.value = DateBox.outputDateString(d);
        DateBox.validate(input);
        break;
      }
    }
  },

  onMouseScroll : function (e) {
    if (!e) var e = window.event;
    var input = this;

    if ("" != input.value) {
      var d = DateBox.parseDateString(input.value);
      if (e.wheelDelta <= 0 || e.detail > 0) {
        d.setDate(d.getDate() + 1);
      } else {
        d.setDate(d.getDate() - 1);
      }
      input.value = DateBox.outputDateString(d);
      DateBox.validate(input);
      if (e.preventDefault) e.preventDefault(); // Mozilla, don't scroll page
      return false; // Internet Explorer, don't scroll the page
    }
  }
};

// EOF
