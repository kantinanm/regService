const express = require('express');
var bodyParser = require('body-parser');
//var htmlToJson = require('html-to-json');
//var config = require('./config');
var util = require('./util');
var app = express();

app.use(bodyParser.json());
//app.use(express.static('public'));

app.get('/studentinfo/:student_id', function (req, res) {
    util.getStudentInfo(req.params.student_id, function (result) {
        res.json(result);
    });
});

app.get('/checkstudent/:student_id', function (req, res) {
    util.findStudentbyId(req.params.student_id, function (result) {
        res.json(result);
    });
});

app.get('/course/:year/:semester/:courseid', function (req, res) {
    util.getCourseInfo(req.params.year, req.params.semester, req.params.courseid, function (result) {
        res.json(result); //year, semester, courseid
    });
});


var port = process.env.PORT || 3000;

app.listen(port, function () {
    console.log('Starting node.js on port ' + port);

});