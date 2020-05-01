/* eslint-disable no-unused-vars */
var http = require('http');
var config = require('./config');
var iconv = require('iconv-lite');
var htmlToJson = require('html-to-json');
var querystring = require('querystring');

exports.getUTF8 = function (url_path, cb) {
  http.get(url_path, function (res) {
    var str = [];
    res.on('data', function (chunk) {
      str.push(chunk);
    });

    res.on('end', function () {
      var total = 0;
      for (var i = 0; i < str.length; i++) {
        total += str[i].length;
      }
      var content = Buffer.concat(str, total);
      var utf8st = iconv.decode(content, 'win874');
      cb(utf8st);
    });
  });
};


exports.extractLink = function (str, cb) {
  htmlToJson.parse(str, {
    'links': ['a', function ($a) {
      var tmp = {
        'href': $a.attr('href'),
        'text': $a.text()
      };
      return tmp;
    }]
  }, function (err, result) {
    cb(result.links);
  });
}


var getLink = function (str, cb) {
  htmlToJson.parse(str, {
    'links': ['a', function ($a) {
      var tmp = {
        'href': $a.attr('href'),
        'text': $a.text()
      };
      return tmp;
    }]
  }, function (err, result) {
    cb(result.links);
  });
}

var toUTF8 = function (res, cb) {
  var str = [];
  res.on('data', function (chunk) {
    str.push(chunk);
  });

  res.on('end', function () {
    var total = 0;
    for (var i = 0; i < str.length; i++) {
      total += str[i].length;
    }
    var content = Buffer.concat(str, total);
    var utf8st = iconv.decode(content, 'win874');
    cb(utf8st);
  });
};

var login = function (cb) {
  var cookies = '';

  var get_buildkey = function (cb) {
    var options = {
      hostname: 'reg.nu.ac.th',
      path: '/registrar/login.asp',
      method: 'GET'
    };

    var req = http.request(options, function (res) {
      cookies = res.headers['set-cookie'][0];
      var str = '';
      res.on('data', function (chunk) {
        str += chunk;
      });
      res.on('end', function () {
        htmlToJson.parse(str, {
          'input': ['input', function ($input) {
            var tmp = {
              'name': $input.attr('name'),
              'value': $input.attr('value')
            };
            return tmp;
          }]
        }, function (err, result) {
          var build_key = '';
          for (var i = 0; i < result.input.length; i++) {
            if (result.input[i].name == 'BUILDKEY') {
              build_key = result.input[i].value;
              break;
            }
          }
          cb(build_key);
        });
      });
    });
    req.end();
  };

  var go_staff = function (main_url) {
    var options = {
      hostname: 'reg.nu.ac.th',
      path: main_url,
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    };

    var req = http.request(options, function (res) {
      toUTF8(res, function (str) {
        getLink(str, function (links) {
          cb(cookies, links);
        });
      });
    });
    req.end();
  }


  var go_role = function (main_url) {
    var options = {
      hostname: 'reg.nu.ac.th',
      path: '/registrar/' + main_url,
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    };

    var req = http.request(options, function (res) {
      var str = '';
      res.on('data', function (chunk) {
        str += chunk;
      });
      res.on('end', function () {
        htmlToJson.parse(str, {
          'url': function ($doc) {
            return $doc.find('a').attr('href');
          },
        }, function (err, result) {
          go_staff(result.url);
        });
      });
    });
    req.end();
  }

  get_buildkey(function (build_key) {
    var postData = querystring.stringify({
      'BUILDKEY': build_key,
      'f_uid': config.user,
      'f_pwd': config.password
    });

    console.log(postData);

    var options = {
      hostname: 'reg.nu.ac.th',
      path: '/registrar/validate.asp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
        'Cookie': cookies
      }
    };

    var req = http.request(options, function (res) {
      var str = '';
      res.on('data', function (chunk) {
        str += chunk;
      });
      res.on('end', function () {
        htmlToJson.parse(str, {
          'url': function ($doc) {
            return $doc.find('a').attr('href');
          },
        }, function (err, result) {
          go_role(result.url);
          // logon success pass cookie
          // cb(cookies);
        });
      });
    });

    req.write(postData);
    req.end();

    // cb(build_key);
  });
};

exports.getCourseInfo = function (year, semester, courseid, cb) {
  var config = {
    year: year,
    semester: semester,
    courseid: courseid
  }

  login(function (ck, links) {
    var classinfo_url = '';

    for (var i = 0; i < links.length; i++) {
      if ((/^class_info/).test(links[i].href)) {
        classinfo_url = links[i].href;
      }
    }

    console.log('classinfo_url', classinfo_url);

    var options = {
      hostname: 'reg.nu.ac.th',
      path: '/registrar/' + classinfo_url,
      method: 'GET',
      headers: {
        'Cookie': ck
      }
    };

    var req = http.request(options, function (res) {
      toUTF8(res, function (utf8str) {
        htmlToJson.parse(utf8str, {
          'form': ['form', function ($form) {
            return $form.attr("action");
          }]
        }, function (err, result) {
          var forms = result.form;
          var action_url = '';
          for (var i = 0; i < forms.length; i++) {
            if ((/^class_info_1/).test(forms[i])) {
              action_url = forms[i];
            }
          }
          submit_form(ck, action_url, config, cb);
        });
      });
    });

    req.end();

    var query_grade = function (cookie, url, cb) {
      console.log(url.href);
      var options = {
        hostname: 'reg.nu.ac.th',
        path: '/registrar/' + url.href,
        method: 'GET',
        headers: {
          'Cookie': cookie
        }
      };

      var req = http.request(options, function (res) {
        toUTF8(res, function (utf8str) {
          htmlToJson.parse(utf8str, {
            'tr': ['tr', function ($tr) {
              var tmp = {
                //  'id': $tr.children(1).text(),
                'id': ($tr.children(1).text()).substring(0, 3),
                'course_plan': $tr.children(3).text(),
                // 'course_plan': $tr.children(3).text().replace(/\s+/g,''),
                'grade': $tr.children(5).text().replace(/\s+/g, '')
              }
              // if(tmp.id.length<20) { 
              return tmp;
              // }
            }]
          }, function (err, result) {
            var r = [];
            var tr = result.tr;
            for (var i = 0; i < tr.length; i++) {
              // if(tr[i]&&(/\d{8}/).test(tr[i].id)) {
              if (tr[i] && ((tr[i].grade.length == 2) | (tr[i].grade.length == 1))) {
                r.push(tr[i]);
              }

            }
            cb(r);
          });
        });
      });
      req.end();
    };

    var query_section = function (cookie, url, cb) {
      console.log(url.href);
      var options = {
        hostname: 'reg.nu.ac.th',
        path: '/registrar/' + url.href,
        method: 'GET',
        headers: {
          'Cookie': cookie
        }
      };

      var req = http.request(options, function (res) {
        toUTF8(res, function (utf8str) {
          htmlToJson.parse(utf8str, {
            'tr': ['tr', function ($tr) {
              var tmp = {
                'count': $tr.children().length,
                'text': $tr.text()
              };

              for (var i = 0; i < $tr.children().length; i++) {
                tmp['td' + i] = $tr.children(i).text();
              }
              return tmp;
            }]
          }, function (err, result) {
            // find group name
            var group_row = 0;
            for (var i = 0; i < result.tr.length; i++) {
              if (result.tr[i].count == 11) {
                group_row = i;
                break;
              }
            }
            console.log('group_row', group_row);
            // group_id
            var idx = group_row + 1;
            var group_id = result.tr[idx].td1.replace(/\s+/g, '');
            var date_section = [];
            while (result.tr[idx].count == 14) {
              var tmp = {
                'day': result.tr[idx].td3,
                'time': result.tr[idx].td4,
                'room': result.tr[idx].td5
              }
              date_section.push(tmp);
              idx++;
            }

            var lecturer = result.tr[idx].td4;




            var section_info = {
              /*'id':result.font[0].value,'name_en':result.font[1].value
              ,'name_th':result.font[2].value	
              ,'faculty':result.font[4].value	
              ,'credit':result.font[6].value	
              ,'semester':result.font[12].value
              ,'planner':result.font[14].value*/
              'id': result.tr[8].td0,
              'name_en': result.tr[8].td1,
              'faculty': result.tr[10].td2,
              'credit': result.tr[11].td2,
              'status': result.tr[12].td2
                //,'planner':result.font[15+add_index].td1
                ,
              'section_no': group_id,
              'date_section': date_section,
              'lecturer': lecturer,
              //  'count_student':grade_list.length
              //,'status_remove_prefix':add_index
              // 'result':result
            };
            //console.log(section_info);
            getLink(utf8str, function (links) {
              for (var i = 0; i < links.length; i++) {
                if ((/^student_inclass/).test(links[i].href)) {
                  query_grade(cookie, links[i], function (grade_list) {
                    section_info['grade_list'] = grade_list;
                    cb(section_info);
                  });
                }
              }
            });
          });

        });
      });

      req.end();
    };

    var submit_form = function (cookie, action_url, config, cb) {
      console.log('submit_form');
      console.log(action_url);
      var postData = querystring.stringify({
        'coursestatus': 'O00',
        'facultyid': 'all',
        'maxrow': '500',
        'acadyear': config.year,
        'semester': config.semester,
        'coursecode': config.courseid,
        'cmd': 2
      });

      console.log(postData);

      var options = {
        hostname: 'reg.nu.ac.th',
        path: '/registrar/' + action_url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length,
          'Cookie': cookie
        }
      };

      var req = http.request(options, function (res) {
        toUTF8(res, function (utf8str) {
          htmlToJson.parse(utf8str, {
            /*
            'sections': ['a', function ($a) {
              var tmp = {
                'href': $a.attr('href'),
                'text': $a.text()
              };
              return tmp;
            }]*/

            'tag': ['tr td', function ($tr) {
              var tmp = {
                'text': $tr.text()
              };

              for (var i = 0; i < $tr.children().length; i++) {
                tmp['td' + i] = $tr.children(i).text();
              }
              return tmp;
            }]

          }, function (err, result) {


            let step = 25;
            let indexKeeper = [];
            var subjects = [];

            if (result.tag.length == 24) {
              //not found

              cb({
                "result": "not_found"
              });

            } else {
              //found
              for (let j = 0; j < (result.tag.length - 25 - 26) / 10; j++) {
                console.log("start new row " + j);
                console.log(step);

                var passIndex = {
                  'subject_id': step++,
                  'subject_name': step++,
                  'unit': step++,
                  'schedule_times': step++,
                  'section': step++,
                  'capacity': step++,
                  'enroll': step++,
                  'remain': step++,
                  'status': step++
                }
                step++;
                step++;

                indexKeeper.push(passIndex);
              }


              for (let n = 0; n < indexKeeper.length - 1; n++) {
                console.log("read row " + n);

                let temStr = result.tag[indexKeeper[n]['section']].text.split(' ');

                var tmp = {
                  'subject_id': result.tag[indexKeeper[n]['subject_id']].text.trim(),
                  'subject_name': result.tag[indexKeeper[n]['subject_name']].text.trim(),
                  'unit': result.tag[indexKeeper[n]['unit']].text.trim(),
                  'schedule_times': result.tag[indexKeeper[n]['schedule_times']].text.trim(),
                  'section_number': temStr[0],
                  //'section': result.tag[indexKeeper[n]['section']].text.trim(),
                  'capacity': result.tag[indexKeeper[n]['capacity']].text.trim(),
                  'enroll': result.tag[indexKeeper[n]['enroll']].text.trim(),
                  'remain': result.tag[indexKeeper[n]['remain']].text.trim(),
                  'status': result.tag[indexKeeper[n]['status']].text.trim()
                }

                subjects.push(tmp);
              }

              cb(subjects);


            } // end else //found


            //cb(result);
            /*
            var r = [];
            for (var i = 0; i < result.sections.length; i++) {
              if (result.sections[i].text == courseid) {
                r.push(result.sections[i]);
              }
            }
            if (r.length == 0) {
              cb([]);
            } else {
              var ret = [];
              for (let i = 0; i < r.length; i++) {
                query_section(cookie, r[i], function (section_info) {
                  ret.push(section_info);
                  if (ret.length == r.length) {
                    cb(ret);
                  }
                });
              }
            }
          */
          });
        });
      });

      req.write(postData);
      req.end();
    };
  });
};


exports.getStudentInfo = function (student_id, cb) {
  var config = {
    student_id: student_id
  }

  login(function (ck, links) {
    var student_info_url = '';

    for (var i = 0; i < links.length; i++) {
      if ((/^student_info/).test(links[i].href)) {
        student_info_url = links[i].href;
      }
    }

    console.log('get student info', student_info_url);

    //return;

    var options = {
      hostname: 'reg.nu.ac.th',
      path: '/registrar/' + student_info_url,
      method: 'GET',
      headers: {
        'Cookie': ck
      }
    };


    var req = http.request(options, function (res) {
      toUTF8(res, function (utf8str) {
        htmlToJson.parse(utf8str, {
          'form': ['form', function ($form) {
            return $form.attr("action");
          }]
        }, function (err, result) {
          var forms = result.form;
          var action_url = '';
          for (var i = 0; i < forms.length; i++) {
            if ((/^student_info/).test(forms[i])) {
              action_url = forms[i];
            }
          }
          submit_form(ck, action_url, config, cb);
        });
      });
    });

    req.end();

    var submit_form = function (cookie, action_url, config, cb) {

      console.log('submit_form');
      console.log(action_url);

      //return;
      var postData = querystring.stringify({
        'StudentCode': config.student_id

      });


      var options = {
        hostname: 'reg.nu.ac.th',
        path: '/registrar/' + action_url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length,
          'Cookie': cookie
        }
      };


      var req = http.request(options, function (res) {
        toUTF8(res, function (utf8str) {

          htmlToJson.parse(utf8str, {

            'tag': ['tr td FONT', function ($tr) {

              var tmp = {
                'text': $tr.text()
              };

              return tmp;
            }]


          }, function (err, result) {

            console.log(result);

            var student_name = '';
            var student_status = '';
            var student_info = [];
            var curriculum_number = '';
            var curriculum_name = '';
            var degree = '';
            var year = '';
            var gpa_x = '';

            let step = 26;
            let indexKeeper = [];

            for (let j = 0; j < (result.tag.length - 25 - 3) / 9; j++) {
              console.log("start new row " + j);
              console.log(step);

              var passIndex = {
                'acadyear': step++,
                'semester': step++,
                'description': step++,
                'status': step++,
                'gpa': step++,
                'gpax': step++,
                'ca': step++,
                'cax': step++,
                'fee': step++
              }

              indexKeeper.push(passIndex);
            }

            for (let i = 0; i < result.tag.length; i++) {

              if (i == 5) {
                student_status = result.tag[i].text;
              }

              if (i == 7) {
                student_name = result.tag[i].text;
              }

              if (i == 11) {
                degree = result.tag[i].text;
              }

              if (i == 13) {
                let curriculum_obj = result.tag[i].text.split(':');
                curriculum_number = curriculum_obj[0];
                curriculum_name = curriculum_obj[1];
              }

              if (i == 15) {
                gpa_x = result.tag[i].text;
              }

            }


            for (let n = 0; n < indexKeeper.length - 1; n++) {
              console.log("read row " + n);
              console.log(result.tag[indexKeeper[n]['acadyear']].text);


              if ((result.tag[indexKeeper[n]['acadyear']].text).replace(/\s+/g, '') == '') {
                console.log("")
              } else {
                year = result.tag[indexKeeper[n]['acadyear']].text;
              }

              var tmp = {
                'acadyear': year,
                'semester': result.tag[indexKeeper[n]['semester']].text,
                'status': result.tag[indexKeeper[n]['status']].text,
                'description': result.tag[indexKeeper[n]['description']].text,
                'gpa': result.tag[indexKeeper[n]['gpa']].text,
                'gpax': result.tag[indexKeeper[n]['gpax']].text,
                'ca': result.tag[indexKeeper[n]['ca']].text,
                'cax': result.tag[indexKeeper[n]['cax']].text,
                'fee': result.tag[indexKeeper[n]['fee']].text
              }
              //tmp['acadyear'] = year;
              student_info.push(tmp);

            }

            let dataOutput = {
              'student_name': student_name,
              'student_id': config.student_id,
              'status': student_status,
              'gpa_x': gpa_x,
              'degree': degree,
              'curriculum_number': curriculum_number,
              'curriculum_name': curriculum_name,
              'info': student_info,
            }
            cb(dataOutput);
            //cb(result);
          });

        });
      });

      req.write(postData);
      req.end(); //submit_form
    } // end submit_form


  });
};

exports.findStudentbyId = function (student_id, cb) {
  var config = {
    student_id: student_id
  }

  login(function (ck, links) {
    var student_info_url = '';

    for (var i = 0; i < links.length; i++) {
      if ((/^staff_imp/).test(links[i].href)) {
        student_info_url = links[i].href;
      }
    }

    console.log('get student info', student_info_url);

    //return;

    var options = {
      hostname: 'reg.nu.ac.th',
      path: '/registrar/' + student_info_url,
      method: 'GET',
      headers: {
        'Cookie': ck
      }
    };


    var req = http.request(options, function (res) {
      toUTF8(res, function (utf8str) {
        htmlToJson.parse(utf8str, {
          'form': ['form', function ($form) {
            return $form.attr("action");
          }]
        }, function (err, result) {
          var forms = result.form;
          var action_url = '';
          for (var i = 0; i < forms.length; i++) {
            if ((/^staff_imp/).test(forms[i])) {
              action_url = forms[i];
            }
          }
          submit_form(ck, action_url, config, cb);
        });
      });
    });

    req.end();

    var submit_form = function (cookie, action_url, config, cb) {

      console.log('submit_form');
      console.log(action_url);

      //return;
      var postData = querystring.stringify({
        'cmd': '1',
        'f_studentcode': config.student_id,
        'f_studentname': '',
        'f_studentsurname': '',
        'f_studentstatus': 'all',
        'f_studentnation': 'all',
        'f_maxrows': 25
      });

      console.log('postData');
      console.log(postData);

      var options = {
        hostname: 'reg.nu.ac.th',
        path: '/registrar/' + action_url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length,
          'Cookie': cookie
        }
      };


      var req = http.request(options, function (res) {

        //console.log(res);
        toUTF8(res, function (utf8str) {

          htmlToJson.parse(utf8str, {

            'link': ['a', function ($a) {
              var tmp = {
                'href': $a.attr('href'),
                'text': $a.text()
              };
              return tmp;
            }]


          }, function (err, result) {

            let student_code = ""; // รหัสนักศึกษาที่ดึงได้จาก reg ต้องมี 8 หลัก
            let linkGetStudentInfo = ""; // link สำหรับการ get ค่าใน step ต่อไปในการเข้าไปดึงข้อมูล
            // eg. https://reg2.nu.ac.th/registrar/staff_imp.asp?studentid=100240987&cmd=2&avs29177189=12
            let student_id_reg = ""; // รหัสประจำตัวในระบบ reg , Primary id of student

            for (let i = 0; i < result.link.length; i++) {
              if (i == 3) {
                student_code = result.link[i].text;
                linkGetStudentInfo = result.link[i].href;
              }
            }

            if (student_code.length == 8) {
              // found student info

              let tempLinkobj = linkGetStudentInfo.split('&');
              var infoTarget = tempLinkobj[0];
              let tempInfoLinkObj = infoTarget.split('=');
              student_id_reg = tempInfoLinkObj[1]; // รหัสประจำตัวในระบบ reg , Primary id of student

              //ส่ง link ไป get data อีก

              var student_info = {
                "result": "OK",
                "student_code": student_code,
                "student_id_reg": student_id_reg
              };

              console.log("link to get : " + linkGetStudentInfo);
              url_hock(cookie, linkGetStudentInfo, function (tag) {

                var options_call = {
                  hostname: 'reg.nu.ac.th',
                  path: '/registrar/' + tag.links[0].href,
                  method: 'GET',
                  headers: {
                    'Cookie': cookie
                  }
                };

                console.log(options_call);

                var reqAgain = http.request(options_call, function (response) {
                  toUTF8(response, function (utf8strInner) {
                    console.log("to get ....");
                    getLink(utf8strInner, function (links) {
                      for (var i = 0; i < links.length; i++) {
                        if ((/^biblio/).test(links[i].href)) {
                          query_profile(cookie, links[i], function (tr_profile) {
                            //section_info['grade_list'] = tr_profile;
                            student_info['pid'] = tr_profile.pid;
                            student_info['fullname'] = tr_profile.fullname;
                            student_info['fullname_eng'] = tr_profile.fullname_eng;
                            student_info['faculty'] = tr_profile.faculty;
                            student_info['curriculum'] = tr_profile.curriculum;
                            student_info['major'] = tr_profile.major;
                            student_info['degree'] = tr_profile.degree;
                            student_info['certificate_name'] = tr_profile.certificate_name;
                            student_info['education_status'] = tr_profile.education_status;
                            student_info['teacher'] = tr_profile.teacher;
                            student_info['gpa'] = tr_profile.gpa;
                            //student_info['profile'] = tr_profile;
                            cb(student_info);
                          });
                        }
                      }
                    });

                  });
                });
                reqAgain.end();


                //cb(tag);


                //student_info['profile'] = tag;


              });

              console.log("call back student_info.");
              //cb(student_info);

            } else {
              // not found
              cb({
                "result": "not_found"
              });
              //cb(result);
            }




            //cb(result);
          });

        });
      });

      req.write(postData);
      req.end(); //submit_form
    } // end submit_form

    var url_hock = function (cookie, action_url, cb) {
      console.log('url_hock');
      console.log(action_url);

      var options = {
        hostname: 'reg.nu.ac.th',
        path: '/registrar/' + action_url,
        method: 'GET',
        headers: {
          'Cookie': cookie
        }
      };

      var req = http.request(options, function (res) {
        toUTF8(res, function (utf8str) {
          //console.log(res);

          htmlToJson.parse(utf8str, {

            'links': ['a', function ($a) {
              var tmp = {
                'href': $a.attr('href'),
                'text': $a.text()
              };
              return tmp;
            }]

          }, function (err, result) {

            /*for (var i = 0; i < result.links.length; i++) {
              if ((/^biblio/).test(links[i].href)) {
                query_profile(cookie, links[i], function (profile) {
                  section_info['grade_list'] = grade_list;
                  cb(section_info);
                });
              }
            }*/
            cb(result);

          }); // end htmlToJson.parse


          /*getLink(utf8str, function (links) {
            for (var i = 0; i < links.length; i++) {
              if ((/^biblio/).test(links[i].href)) {
                query_profile(cookie, links[i], function (tr_profile) {
                  //section_info['grade_list'] = tr_profile;
                  cb(tr_profile);
                });
              }
            }
          });*/

        }); // end toUTF8

      }); // end http.request
      req.end();
    }

    var query_profile = function (cookie, url, cb) {
      //console.log(url.href);
      var options = {
        hostname: 'reg.nu.ac.th',
        path: '/registrar/' + url.href,
        method: 'GET',
        headers: {
          'Cookie': cookie
        }
      };

      var req = http.request(options, function (res) {
        toUTF8(res, function (utf8str) {
          htmlToJson.parse(utf8str, {
            'tr': ['tr', function ($tr) {
              var tmp = {
                'text': $tr.text()
              };
              return tmp;
            }]
          }, function (err, result) {
            console.log(result);

            var profile = {};

            for (let i = 0; i < result.tr.length; i++) {
              if (i == 14) {
                let temStr = result.tr[i].text.split(':');
                profile['pid'] = temStr[1].trim(); //  เลขที่บัตรประชาชน
              }

              if (i == 15) {
                let temStr = result.tr[i].text.split(':');
                profile['fullname'] = temStr[1].trim(); //  ชื่อ-นามสกุล
              }

              if (i == 16) {
                let temStr = result.tr[i].text.split(':');
                profile['fullname_eng'] = temStr[1].trim(); //  ชื่อ-นามสกุล ภาษาอังกฤษ
              }

              if (i == 17) {
                let temStr = result.tr[i].text.split(':');
                profile['faculty'] = temStr[1].trim(); //  คณะ
              }

              if (i == 19) {
                let temStr = result.tr[i].text.split(':');
                profile['curriculum'] = temStr[1].trim(); //  หลักสูตร
              }

              if (i == 20) {
                let temStr = result.tr[i].text.split(':');
                if (temStr.length == 1) {
                  profile['major'] = "-";
                } else {
                  profile['major'] = temStr[1].trim(); //  วิชาโท แขนง
                }
              }

              if (i == 21) {
                let temStr = result.tr[i].text.split(':');
                profile['degree'] = temStr[1].trim(); //  ระดับการศึกษา
              }

              if (i == 22) {
                let temStr = result.tr[i].text.split(':');
                profile['certificate_name'] = temStr[1].trim(); //   ชื่อปริญญา
              }

              if (i == 23) {
                let temStr = result.tr[i].text.split(':');
                profile['entry_date'] = temStr[1].trim(); //  ปีการศึกษาที่เข้า
              }

              if (i == 24) {
                let temStr = result.tr[i].text.split(':');
                profile['education_status'] = temStr[1].trim(); //  สถานภาพ
              }

              if (i == 25) {
                let temStr = result.tr[i].text.split(':');
                profile['entry_method'] = temStr[1].trim(); //  วิธีรับเข้า
              }

              if (i == 27) {
                let temStr = result.tr[i].text.split(':');
                profile['high_school'] = temStr[1].trim(); //  จบการศึกษาจาก
              }

              if (i == 28) {
                let temStr = result.tr[i].text.split(':');
                profile['teacher'] = temStr[1].trim(); //  อ. ที่ปรึกษา
              }

              if (i == 31) {
                let temStr = result.tr[i].text.split(' ');
                profile['unit_cal'] = temStr[1].trim(); //  หน่วยกิตคำนวณ
              }

              if (i == 32) {
                let temStr = result.tr[i].text.split(' ');
                profile['unit_pass'] = temStr[1].trim(); //  หน่วยกิตที่ผ่าน
              }

              if (i == 33) {
                let temStr = result.tr[i].text.split(' ');
                profile['gpa'] = temStr[1].trim(); //  คะแนนเฉลี่ยสะสม
              }

              if (i == 35) {
                let temStr = result.tr[i].text.split(':'); //เดือน ปี เกิด (พ.ศ.) : 8/9/2541
                profile['dob'] = temStr[1].trim(); //  
              }

              if (i == 36) {
                let temStr = result.tr[i].text.split(':');
                profile['province'] = temStr[1].trim(); // จังหวัดที่เกิด 
              }

              if (i == 37) {
                let temStr = result.tr[i].text.split(':');
                profile['nation'] = temStr[1].trim(); // สัญชาติ 
              }

              if (i == 38) {
                let temStr = result.tr[i].text.split(':');
                profile['region'] = temStr[1].trim(); // ศาสนา 
              }

              if (i == 39) {
                let temStr = result.tr[i].text.split(':');
                profile['blood_group'] = temStr[1].trim(); // หมู่เลือด 
              }

            }

            cb(profile);
            //cb(result);
          });
        });
      });
      req.end();
    }; // end query profile

  }); // login
};