'use strict';

module.exports.hello = (event, context, callback) => {
  
  try {
//    const { queryStringParameters: { category } } = event;
    const category = event.queryStringParameters.category;
  } catch (err) {
    const category = 'yes';
  }

  const category = event.queryStringParameters.category;

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      url: YOUTUBE_CATEGORIES[category],
      input: event,
    }),
  };

  callback(null, response);

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};

module.exports.categories = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: REQUEST_URL_CATEGORIES,
    }),
  };

  callback(null, response);
};

module.exports.category = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'yes',
    }),
  };

  callback(null, response);
};
