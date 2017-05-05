'use strict'; 
const fetch = require('node-fetch');

// CONSTANTS
const GOOGLE_API_KEY = 'AIzaSyDEUoHAKBd1IEbtSclPajMCecbRJNKHQvI';
const GOOGLE_YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
const REQUEST_URL_CATEGORIES = `${GOOGLE_YOUTUBE_API_URL}/playlists`;
const REQUEST_URL_CATEGORY = `${GOOGLE_YOUTUBE_API_URL}/playlistItems`;
const CHANNEL_ID = 'UCzMhCVtm3sxKoU8279I1sHA';
// CONSTANTS

function makeCategoriesRequestURL(URL, id) {
  return `${URL}/?part=snippet&channelId=${id}&key=${GOOGLE_API_KEY}`;
}

function makeCategoryRequestURL(URL, id) {
  return `${URL}/?part=snippet&playlistId=${id}&key=${GOOGLE_API_KEY}`;
}

function fetchRequest(URL) {
  return fetch(URL)
    .then((response) => {
      return response.json();
    });
}

function parseData(data) {
  return data.items.map( (item) => {
    return {
      name: item.snippet.title,
      id: item.id,
      url: item.snippet.thumbnails.medium.url,
    };
  });
}

module.exports.categories = (event, context, callback) => {
  const requestCategoriesURL = makeCategoriesRequestURL(REQUEST_URL_CATEGORIES, CHANNEL_ID);

  fetchRequest(requestCategoriesURL)
    .then(parseCategoriesData)
    .then( (data) => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          list: data,
        }).
      });
};

module.exports.category = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'yes!',
    }),
  };

  callback(null, response);
};
