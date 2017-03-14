// Check if a url is responding and logs an event to AWS CloudWatch
// initial (C) ActValue 2016 - pmosconi
// (c) Digital Lumens Inc.
// Brian Del Vecchio <bdv@digitallumens.com>

// jshint esversion: 6
// jshint node: true

"use strict";

// external dependencies
const AWS = require('aws-sdk');
const request = require('request-promise');
const errors = require('request-promise/errors');
const _ = require('underscore');

const timeout = 3000; // ms to wait for response

const cloudwatch = new AWS.CloudWatch();

// discover the instances we should poll
exports.discover = () => {
  var ec2 = new AWS.EC2();

  var params = {
    Filters: [
      {
        Name: 'tag:Application',
        Values: [
          'lightworks',
        ]
      },
    ],
  };

  var instances = [];

  return ec2.describeInstances(params).promise()
    .then(function(data) {

      data.Reservations.forEach(function(reservation) {
        const instance = reservation.Instances[0];
        const running = (instance.State.Name == 'running');

        if (running) {
          const instanceName = _.findWhere(instance.Tags, {Key: 'Name'}).Value;
          instances.push(instanceName);
        }
      });

      return instances;

    });
};

function putMetricData(instanceName, value){
  var params = {
      MetricData: [ /* required */
          {
              MetricName: 'EndpointNotResponding', /* required */
              Dimensions: [
                  {
                      Name: 'instance', /* required */
                      Value: instanceName /* required */
                  }
              ],
              Timestamp: new Date(),
              Unit: 'Count',
              Value: value
          }
      ],
      Namespace: 'Siteworx' /* required */
  };

  cloudwatch.putMetricData(params).promise()
  .then(function(response){
    console.log("cw callback: ", response);
  })
  .catch(function(reason){
    console.log(`cw error: ${reason}`);
  });

}

exports.handler = (event, context, callback) => {

    // ignore invalid SSL certificate
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    this.discover().then(function(instances){

      instances.forEach(function(instance){
        const url = `https://${instance}.siteworx.io/api/v1/version`;
        console.log(`checking ${url}`);

        request.get(url, {timeout: timeout})
          .then(function(response, body){

            console.log(`${instance} response: ${response}`);
            putMetricData(instance, 0);

          })
          .catch(errors.StatusCodeError, function (reason) {
              // The server responded with a status codes other than 2xx.
              console.log(`${instance} statusCode: ${reason.statusCode}`);
              putMetricData(instance, 1);
          })
          .catch(errors.RequestError, function (reason) {
            console.log(`${instance} error: ${reason}`);
            putMetricData(instance, 1);
          });
      });

    })
    .catch(function(error){
      console.log("discover error: " + error);
    });

};


// invoke with `node LambdaWebCheck.js handler`
require('make-runnable');
