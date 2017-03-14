// Check if a url is responding and logs an event to AWS CloudWatch
// (C) ActValue 2016 - pmosconi

// jshint esversion: 6
// jshint node: true

"use strict";

// external dependencies
const AWS = require('aws-sdk');
const request = require('request');
const _ = require('underscore');

// PUT YOUR URL HERE
const url = 'https://mywebsite.com/';
const timeout = 10000; // ms to wait for response


// get reference to cloudwatch
const cloudwatch = new AWS.CloudWatch();

function matchesTag(item,key){

}

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
        const instanceName = _.findWhere(instance.Tags, {Key: 'Name'}).Value;

        if (running) {
          console.log(instanceName + ' is ' + instance.State.Name);
          instances.push(instanceName);
        }
      });

      return instances;

    });
};

exports.handler = (event, context, callback) => {

    // ignore invalid SSL certificate
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";



    // call url and if response code is not 200 something is not working
    request.get(url, {timeout: timeout},
    (err, response, body) => {

        let value = 0;

        if (err) {
            console.log('Error: ' + err);
            value = 1;
        }
        else if (response.statusCode !== 200) {
            console.log('Status Code: ' + response.statusCode);
            value = 1;
        }
        else console.log('Status Code: 200');

        let params = {
            MetricData: [ /* required */
                {
                    MetricName: 'WebSiteNotResponding', /* required */
                    Dimensions: [
                        {
                            Name: 'url', /* required */
                            Value: url /* required */
                        }
                    ],
                    Timestamp: new Date(),
                    Unit: 'Count',
                    Value: value
                }
            ],
            Namespace: 'ActValue' /* required */
        };

        cloudwatch.putMetricData(params, (err, data) => {
            if (err) callback(err, 'KO');
            else callback(null, data);
        });

    });


};

require('make-runnable');
