import es6Promise from 'es6-promise';
import fetch from 'isomorphic-fetch';
import { URLQueryStringBuilder, flattenAdditionalPartyInfo } from './utils';

es6Promise.polyfill();

class OpenEHR {
  static get Genders () {
    return {
      MALE: 'MALE',
      FEMALE: 'FEMALE'
    };
  }

  constructor (openEhrUrl, subjectNamespace, username, password) {
    this.endpoints = {
      demographic: 'demographics',
      party: 'demographics/party',
      ehr: 'ehr',
      query: 'query',
      composition: 'composition'
    };

    // Strip the terailing slash if its supplied.
    this.baseUrl = (openEhrUrl.endsWith('/')) ? openEhrUrl.replace(/\/$/, '') : openEhrUrl;
    this.username = username;
    this.password = password;
    this.subjectNamespace = subjectNamespace;
  }

  getAuthorizationHeader = () => {
    if (!this.authorizationHeader) {
      const base64Credentials =
          new Buffer(`${this.username}:${this.password}`).toString('base64');
      this.authorizationHeader = `Basic ${base64Credentials}`;
    }
    return this.authorizationHeader;
  };

  getOpenEhr = (urlEndpoint, callback, errorCallback) => {
    const url = `${this.baseUrl}/${urlEndpoint}`;

    const options = {
      headers: {
        'Authorization': this.getAuthorizationHeader()
      },
    };

    fetch(url, options)
      .then(function (response) {
        if (!response.ok || response.status === 204) {
          let error = new Error('Bad response from server');
          error.statusCode = response.status;
          throw error;
        }
        return response.json();
      })
      .then(function (json) {
        callback(json);
      })
      .catch(function (ex) {
        if (errorCallback) {
          console.log('got here');
          errorCallback(ex);
        } else {
          console.log('parsing failed', ex);
        }
      });
  };

  postOpenEhr = (urlEndpoint, body, callback) => {
    const url = `${this.baseUrl}/${urlEndpoint}`;

    let options = {
      method: 'post',
      headers: {
        'Authorization': this.getAuthorizationHeader(),
        'Accept': 'application/json'
      }
    };
    console.log(urlEndpoint);
    console.log(body);

    if (body !== null) {
      options.body = body;
      options.headers['Content-Type'] = 'application/json';
    }

    fetch(url, options)
      .then(function (response) {
        if (response.status >= 400) {
          return response.text();
        }
        return response.json();
      })
      .then(function (json) {
        callback(json);
      })
      .catch(function (ex) {
        console.log('parsing failed', ex);
      });
  };

  allParties = (callback) => {
    const url = `${this.endpoints.party}/query/?lastNames=*&rnsh.mrn=*`;
    this.getOpenEhr(url, (json) => {
      callback(json.parties);
    });
  };

  searchParties = (searchTerm, callback) => {
    const url = `${this.endpoints.party}/query/?search=*${searchTerm}*&rnsh.mrn=*`;

    this.getOpenEhr(url, (json) => {
      callback(json.parties);
    });
  };

  findParties = (firstNames, lastNames, mrn, callback) => {
    let queryStringBuilder = new URLQueryStringBuilder();

    if (firstNames && firstNames !== '') {
      queryStringBuilder.addParam('firstNames', `*${firstNames}*`);
    }

    if (lastNames && lastNames !== '') {
      queryStringBuilder.addParam('lastNames', `*${lastNames}*`);
    }

    if (mrn && mrn !== '') {
      queryStringBuilder.addParam('rnsh.mrn', `*${mrn}*`);
    }

    const queryString = queryStringBuilder.getQueryString();
    const url = `${this.endpoints.party}/query/${queryString}`;

    this.getOpenEhr(url, (json) => {
      callback(json.parties);
    });
  };

  getParty = (partyId, callback) => {
    const url = `${this.endpoints.party}/${partyId}`;

    this.getOpenEhr(url, (json) => {
      this.getEhr(flattenAdditionalPartyInfo(json.party.partyAdditionalInfo)['rnsh.mrn'], (ehrJson) => {
        json.party.ehrId = ehrJson.ehrId;
        callback(json.party);
      });
    });
  };

  createParty = (firstNames, lastNames, gender, dateOfBirth, address, mrn, tumorType, isSurgical, phone, email, callback) => {
    const url = `${this.endpoints.party}`;

    const partyBody = {
      firstNames: firstNames,
      lastNames: lastNames,
      gender: gender,
      dateOfBirth: dateOfBirth,
      address: {
        address: address
      },
      partyAdditionalInfo: [
        {
          key: 'rnsh.mrn',
          value: mrn
        },
        {
          key: 'tumorType',
          value: tumorType
        },
        {
          key: 'surgical',
          value: isSurgical
        },
        {
          key: 'phone',
          value: phone
        },
        {
          key: 'email',
          value: email
        }
      ]
    };

    this.createEhr(mrn, (ehrResponse) => {
      let ehrResponseJson;
      try {
        var jsonResponse = JSON.parse(ehrResponse);
        ehrResponseJson = jsonResponse;
      } catch (e) {
        ehrResponseJson = ehrResponse;
      }

      if (ehrResponseJson.status === 400 && ehrResponseJson.code === 'EHR-2124') {
        callback(ehrResponseJson);
      } else {
        this.postOpenEhr(url, JSON.stringify(partyBody), (partyResponseJson) => {
          callback(partyResponseJson);
        });
      }
    });
  };

  createEhr = (subjectId, callback) => {
    const url = `${this.endpoints.ehr}/?subjectId=${subjectId}&subjectNamespace=${this.subjectNamespace}`;
    this.postOpenEhr(url, null, (json) => {
      callback(json);
    });
  };

  getEhr = (subjectId, callback) => {
    const url = `${this.endpoints.ehr}/?subjectId=${subjectId}&subjectNamespace=${this.subjectNamespace}`;
    this.getOpenEhr(url, (json) => {
      callback(json);
    });
  };

  getAql = (aql, callback, errorCallback) => {
    const url = `${this.endpoints.query}/?aql=${aql}`;
    this.getOpenEhr(url, (json) => {
      callback(json);
    }, errorCallback);
  };

  getComposition = (compositionUid, callback) => {
    const url = `${this.endpoints.composition}/${compositionUid}?format=STRUCTURED`;
    this.getOpenEhr(url, (json) => {
      callback(json);
    });
  };

  saveComposition = (templateId, ehrId, compositionBody, callback) => {
    const url = `${this.endpoints.composition}/?templateId=${templateId}&ehrId=${ehrId}`;
    this.postOpenEhr(url, compositionBody, (json) => {
      callback(json);
    });
  };

}

export default OpenEHR;
