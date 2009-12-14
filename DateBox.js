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
 * Usage:
 *
 *   DateBox.register(obj);
 *
 *   Where 'obj' is an <input type="text" /> element, or the id of one.
 *   A span will be created dynamically after the input element.
 *   The span will use the CSS classes: DateBoxControlMsg, DateBoxControlErrorMsg.
 *   This span will contain either a formatted date (according to your browser locale),
 *   or an error message if the contents of the input can't be parsed.
 *
 * History:
 *
 *   1.5 - First release on github.
 *         Added localization support, English and Danish locales.
 *         Removed external dependencies.
 *         Chrome and Safari support.
 *         Doubleclick inserts todays date.
 *         Supports both US and European date formats (not at the same time though)
 *   1.4 - Some date formats gave errors in Mozilla, now fixed.
 *         Added mouse wheel scroll handling.
 *   1.3 - Empty input no longer shows error.
 *   1.2 - Added a few new formats.
 */

/*global window */

"use strict";

var DateBox = (function () {
  var locales, l10n, dateParsePatterns;
  
  locales = {
    da: {
      months: 'januar februar marts april maj juni juli august september oktober november december'.split(' '),
      weekdays: 'søndag mandag tirsdag onsdag torsdag fredag lørdag'.split(' '),
      euro: true,
      us: false,
      iso: true,
      outputFormat: 'dd-mm-yyyy',
      patterns: {
        today: /^i ?d/i,
        tomorrow: /^i ?m/i,
        yesterday: /^i ?g/i,
        next: /^næste (\S+)$/i,
        last: /^sidste (\S+)$/i,
        ddmmmyyyy: /^(\d{1,2})\.?(?: (\w+)(?:,? (\d{4}))?)?$/i,
        mmmddyyyy: /^(\w+) (\d{1,2})(?:[\.,]? (\d{4}))?$/i
      },
      errors: {
        invalidMonth: 'Ugyldig værdi for måned. Gyldige måneder er 1 til 12.',
        invalidDay: 'Ugyldig værdi for dag. Gyldige dage for %month% er 1 til %day%.',
        invalidMonthName: 'Ugyldig indtastning for månedsnavn',
        ambiguousMonthName: 'Ikke entydigt månedsnavn',
        invalidWeekday: 'Ugyldig indtastning for ugedag',
        ambiguousWeekday: 'Ikke entydig ugedag',
        unknownFormat: 'Ukendt dato-format',
        unsupportedLocale: 'Unsupported locale: %locale%'
      }
    },
    en: {
      months: 'January February March April May June July August September October November December'.split(' '),
      weekdays: 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' '),
      euro: false,
      us: true,
      iso: true,
      outputFormat: 'mm/dd/yyyy',
      patterns: {
        today: /^tod/i,
        tomorrow: /^tom/i,
        yesterday: /^yes/i,
        next: /^next (\w+)$/i,
        last: /^last (\w+)$/i,
        ddmmmyyyy: /^(\d{1,2})(?:st|nd|rd|th)?(?: (\w+)(?:,? (\d{4}))?)?$/i,
        mmmddyyyy: /^(\w+) (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/i
      },
      errors: {
        invalidMonth: 'Invalid month. Valid months are 1 thru 12.',
        invalidDay: 'Invalid day. Valid days for %month% are 1 thru %day%.',
        invalidMonthName: 'Invalid month string',
        ambiguousMonthName: 'Ambiguous month',
        invalidWeekday: 'Invalid day string',
        ambiguousWeekday: 'Ambiguous weekday',
        unknownFormat: 'Invalid date string',
        unsupportedLocale: 'Unsupported locale: %locale%'
      }
    }
  };
  
  l10n = null;

  function trim(string) {
    return string.replace(/^\s+|\s+$/g, '');
  }
  
  function filter(array, test) {
    var i, matches = [];
    for (i = 0; i < array.length; i += 1) {
      if (test(array[i])) {
        matches[matches.length] = array[i];
      }
    }
    return matches;
  }
  
  function indexOf(array, item) {
    for (var i = 0; i < array.length; i += 1) {
      if (array[i] === item) {
        return i;
      }
    }
    return -1;
  }

  function hookEvent(element, eventName, callback) {
    if ('string' === typeof element) {
      element = document.getElementById(element);
    }
    if (null === element) {
      return;
    }
    if (element.addEventListener) {
      if ('mousewheel' === eventName) {
        element.addEventListener('DOMMouseScroll', callback, false);
      }
      element.addEventListener(eventName, callback, false);
    }
    else if (element.attachEvent) {
      element.attachEvent('on' + eventName, callback);
    }
  }
   
  function cancelEvent(e) {
    e = e ? e : window.event;
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.cancelBubble = true;
    e.cancel = true;
    e.returnValue = false;
    return false;
  }
  
  function dateIsValid(yyyy, mm, dd) {
    // if month out of range
    if (mm < 0 || mm > 11) {
      throw new Error(l10n.errors.invalidMonth);
    }
    
    // get last day in month
    var d = (11 === mm) ? new Date(yyyy + 1, 0, 0) : new Date(yyyy, mm + 1, 0);
    
    // if date out of range
    if (dd < 1 || dd > d.getDate()) {
      throw new Error(l10n.errors.invalidDay.replace('%month%', l10n.months[mm]).replace('%day%', d.getDate().toString()));
    }
    
    return true;
  }

  // Takes a string, returns the index of the month matching that string, throws an error if 0 or more than 1 matches
  function parseMonth(month) {
    var matches = filter(l10n.months, function (item) {
      return new RegExp("^" + month, "i").test(item);
    });
    if (0 === matches.length) {
      throw new Error(l10n.errors.invalidMonthName);
    }
    if (matches.length > 1) {
      throw new Error(l10n.errors.ambiguousMonthName);
    }
    return indexOf(l10n.months, matches[0]);
  }

  // Same as parseMonth but for days of the week
  function parseWeekday(weekday) {
    var matches = filter(l10n.weekdays, function (item) {
      return new RegExp("^" + weekday, "i").test(item);
    });
    if (0 === matches.length) {
      throw new Error(l10n.errors.invalidWeekday);
    }
    if (matches.length > 1) {
      throw new Error(l10n.errors.ambiguousWeekday);
    }
    return indexOf(l10n.weekdays, matches[0]);
  }

  // Array of objects, each has 're', a regular expression and 'handler', a 
  // function for creating a date from something that matches the regular 
  // expression. Handlers may throw errors if string is unparseable. 
  dateParsePatterns = [
    // Today
    {
      re: function () {
        return l10n.patterns.today;
      },
      handler: function () {
        return new Date();
      }
    },
    // Tomorrow
    {
      re: function () {
        return l10n.patterns.tomorrow;
      },
      handler: function () {
        var d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
      }
    },
    // Yesterday
    {
      re: function () {
        return l10n.patterns.yesterday;
      },
      handler: function () {
        var d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
      }
    },
    // 4. [jan [2003]]
    {
      re: function () {
        return l10n.patterns.ddmmmyyyy;
      },
      handler: function (bits) {
        var d, dd, mm, yyyy;
        d = new Date();
        dd = parseInt(bits[1], 10);
        mm = (undefined !== bits[2]) ? parseMonth(bits[2]) : d.getMonth();
        yyyy = (undefined !== bits[3]) ? parseInt(bits[3], 10) : d.getFullYear();

        if (dateIsValid(yyyy, mm, dd)) {
          return new Date(yyyy, mm, dd);
        }
      }
    },
    // jan 4 [2003]
    {
      re: function () {
        return l10n.patterns.mmmddyyyy;
      },
      handler: function (bits) {
        var d, dd, mm, yyyy;
        d = new Date();
        dd = parseInt(bits[2], 10);
        mm = parseMonth(bits[1]);
        yyyy = (undefined !== bits[3]) ? parseInt(bits[3], 10) : d.getFullYear(); 

        if (dateIsValid(yyyy, mm, dd)) {
          return new Date(yyyy, mm, dd);
        }
      }
    },
    // next tuesday - this is suspect due to weird meaning of "next"
    {
      re: function () {
        return l10n.patterns.next;
      },
      handler: function (bits) {
        var d, day, newDay, addDays;
        d = new Date();
        day = d.getDay();
        newDay = parseWeekday(bits[1]);
        addDays = newDay - day;
        if (newDay <= day) {
          addDays += 7;
        }
        d.setDate(d.getDate() + addDays);
        return d;
      }
    },
    // last tuesday
    {
      re: function () {
        return l10n.patterns.last;
      },
      handler: function (bits) {
        var d, wd, nwd, addDays;
        d = new Date();
        wd = d.getDay();
        nwd = parseWeekday(bits[1]);

        // determine the number of days to subtract to get last weekday
        addDays = (-1 * (wd + 7 - nwd)) % 7;

        // above calculate 0 if weekdays are the same so we have to change this to 7
        if (0 === addDays) {
          addDays = -7;
        }

        // adjust date and return
        d.setDate(d.getDate() + addDays);
        return d;
      }
    },
    // dd/mm[/[yy]yy] or dd-mm[-[yy]yy] (European style)
    {
      re: /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2}|\d{4}))?$/,
      handler: function (bits) {
        if (l10n.euro) {
          var d, dd, mm, yyyy;
          d = new Date();
          dd = parseInt(bits[1], 10);
          mm = parseInt(bits[2], 10) - 1;
          yyyy = (undefined !== bits[3]) ? parseInt(bits[3], 10) : d.getFullYear();
          if (undefined !== bits[3] && 2 === bits[3].length) {
            yyyy = d.getFullYear() - (d.getFullYear() % 100) + yyyy;
          }

          if (dateIsValid(yyyy, mm, dd)) {
            return new Date(yyyy, mm, dd);
          }
        }
      }
    },
    // mm/dd[/[yy]yy] or mm-dd[-[yy]yy] (American style)
    {
      re: /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2}|\d{4}))?$/,
      handler: function (bits) {
        if (l10n.us) {
          var d, dd, mm, yyyy;
          d = new Date();
          dd = parseInt(bits[2], 10);
          mm = parseInt(bits[1], 10) - 1;
          yyyy = (undefined !== bits[3]) ? parseInt(bits[3], 10) : d.getFullYear();
          if (undefined !== bits[3] && 2 === bits[3].length) {
            yyyy = d.getFullYear() - (d.getFullYear() % 100) + yyyy;
          }

          if (dateIsValid(yyyy, mm, dd)) {
            return new Date(yyyy, mm, dd);
          }
        }
      }
    },
    // yyyy-mm-dd (ISO style)
    {
      re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      handler: function (bits) {
        if (l10n.iso) {
          var dd, mm, yyyy;
          dd = parseInt(bits[3], 10);
          mm = parseInt(bits[2], 10) - 1;
          yyyy = parseInt(bits[1], 10);

          if (dateIsValid(yyyy, mm, dd)) {
            return new Date(yyyy, mm, dd);
          }
        }
      }
    }
  ];

  // Parses date string input
  function parseDateString(strDateInput) {
    var i, re, handler, bits, result;
    
    // cycle through date parse patterns
    for (i = 0; i < dateParsePatterns.length; i += 1) {
      // get regular expression for this pattern
      re = dateParsePatterns[i].re;
      if ('function' === typeof re && 'Function' === re.constructor.name) { // RegExp's have type "function" in Safari
        re = re();
      }
      
      // get handler function for this pattern
      handler = dateParsePatterns[i].handler;
      
      // parse input using regular expression
      bits = re.exec(strDateInput);
      
      // if there was a match
      if (bits) {
        result = handler(bits);
        if (result) {
          // return the result of the handler function (which constitutes bits into a date)
          return result;
        }
      }
    }
    // if no pattern matched - throw exception
    throw new Error(l10n.errors.unknownFormat);
  }
  
  // Creates date string output
  function outputDateString(dDate) {
    var output = l10n.outputFormat;
    output = output.replace('yyyy', dDate.getFullYear().toString());
    output = output.replace('mm', ('0' + (dDate.getMonth() + 1).toString()).slice(-2));
    output = output.replace('dd', ('0' + dDate.getDate().toString()).slice(-2));
    return output;
  }

  // Validates the input from datebox as a date
  function validate(obj) {
    if ('' === obj.value) {
      // Clear message span associated with textbox
      if (!obj.message.firstChild) {
        obj.message.appendChild(document.createTextNode(''));
      } else {
        obj.message.firstChild.nodeValue = '';
      }
      
      // remove class name
      obj.message.className = '';
      
      return;
    }
    
    try {
      // Parse input to get date (error is raised if it can't be parsed)
      var dtValue = parseDateString(trim(obj.value));
      
      // Assign date in default format to textbox
      obj.value = outputDateString(dtValue);
      
      // Add more formal date to message span associated with textbox
      if (!obj.message.firstChild) {
        obj.message.appendChild(document.createTextNode(dtValue.toLocaleDateString()));
      } else {
        obj.message.firstChild.nodeValue = dtValue.toLocaleDateString();
      }
      
      // swith class name back to default so styling is changed
      obj.message.className = 'DateBoxControlMsg';
    }
    catch (e) {
      // add error message to message div associated with textbox
      if (!obj.message.firstChild) {
        obj.message.appendChild(document.createTextNode(e.message));
      } else {
        obj.message.firstChild.nodeValue = e.message;
      }
      
      // switch class name to error so styling is changed
      obj.message.className = 'DateBoxControlErrorMsg';
    }
  }

  function onKeyDown(e) {
    var key, input, d;
    e = e || window.event;
    key = (e.which) ? e.which : e.keyCode;
    input = e.target || e.srcElement;

    if ('' !== input.value) {
      switch (key) {
      case 38: // up
        d = parseDateString(input.value);
        d.setDate(d.getDate() + 1);
        input.value = outputDateString(d);
        validate(input);
        break;
      case 40: // down
        d = parseDateString(input.value);
        d.setDate(d.getDate() - 1);
        input.value = outputDateString(d);
        validate(input);
        break;
      }
    }
  }

  function onMouseScroll(e) {
    var input, d;
    e = e || window.event;
    input = e.target || e.srcElement;

    if ('' !== input.value) {
      d = parseDateString(input.value);
      if (e.wheelDelta <= 0 || e.detail > 0) {
        d.setDate(d.getDate() + 1);
      } else {
        d.setDate(d.getDate() - 1);
      }
      input.value = outputDateString(d);
      validate(input);
      return cancelEvent(e);
    }
  }
  
  function onDblClick(e) {
    e = e || window.event;
    var input = e.target || e.srcElement;
    
    if ('' === input.value) {
      input.value = outputDateString(new Date());
      validate(input);
      return cancelEvent(e);
    }
  }
  
  function register(element) {
    if ('string' === typeof element) {
      element = document.getElementById(element);
    }
    
    if (null === element) {
      return;
    }
    
    // Add span after control for messages
    var oMsgSpan = document.createElement('span');
    oMsgSpan.className = 'DateBoxControlMsg';
    
    // If there is a next sibling...
    if (element.nextSibling) {
      // ... insert before next sibling
      element.parentNode.insertBefore(oMsgSpan, element.nextSibling);
    } else {
      // ... else append child to parent
      element.parentNode.appendChild(oMsgSpan);
    }
    
    // Link message span to textbox for easy script access
    element.message = oMsgSpan;
    
    // Validate current contents
    validate(element);
    
    // hook up event handlers
    hookEvent(element, 'change', function () {
      validate(element);
    });
    hookEvent(element, 'keydown', onKeyDown);
    hookEvent(element, 'mousewheel', onMouseScroll);
    hookEvent(element, 'dblclick', onDblClick);
  }
  
  function setLocale(locale) {
    if (locales.hasOwnProperty(locale)) {
      l10n = locales[locale];
    } else {
      throw new Error(l10n.errors.unsupportedLocale.replace('%locale%', locale));
    }
  }
  
  setLocale('en');

  return {
    version: '1.5b1',
    register: register,
    setLocale: setLocale
  };
}());

// EOF