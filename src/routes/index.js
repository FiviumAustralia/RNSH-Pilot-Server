var express = require('express');
var router = express.Router();
var patient = require('./patients');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/patient/:patientId', function (req, res, next) {
  // res.send('Got a GET request for followup');
  patient.fetchPatient(res, req.params.patientId);
});

router.get('/patient', function (req, res, next) {
  patient.fetchAllPatients(res);
});

router.post('/patient', function (req, res, next) {
  patient.addPatient(req, res);
});

router.post('/sendaria', function (req, res, next) {
  patient.sendAria(req, res);
});

router.post('/prostate/diagnosis/:ehrId', function (req, res, next) {
  patient.addDiagnosis(req, res);
});

router.get('/prostate/diagnosis/:ehrId', function (req, res, next) {
  patient.getDiagnosis(res, req.params.ehrId);
});

module.exports = router;
