'use strict'; 
const fetch = require('node-fetch');

// AWS Set
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
var s3 = new AWS.S3();

// GM Image Library
let async = require('async');
let gm = require('gm')
            .subClass({ imageMagick: true });

// CONSTANTS
const GOOGLE_API_KEY = '';
const GOOGLE_YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
const REQUEST_URL_CATEGORIES = `${GOOGLE_YOUTUBE_API_URL}/playlists`;
const REQUEST_URL_CATEGORY = `${GOOGLE_YOUTUBE_API_URL}/playlistItems`;
//const CHANNEL_ID = 'UCzMhCVtm3sxKoU8279I1sHA';
const CHANNEL_ID = 'UC1XImqRLQO2vpVTLl_Ad6-Q';
const AWS_S3_URL = "https://s3.amazonaws.com/godori-images";

const supportImageTypes = ["jpg", "jpeg", "png", "gif"];
const ThumbnailSizes = {
  PROFILE: [
    {size: 80, alias: 's', type: 'crop'},
    //{size: 256, alias: 'm', type: 'crop'},
    //{size: 640, alias: 'l', type: 'crop'}
  ],
  ARTICLE: [
    {size: 192, alias: 's'},
    {size: 1280, alias: 'l'}
  ],
  MESSAGE: [
    {size: 1280, alias: 'l'}
  ],
  BUSINESS_ARTICLE_THUMB: [
    {size: 192, alias: 's', type: 'crop'}
  ],
  sizeFromKey: function(key) {
    const type = key.split('/')[1];
    if (type === 'article') {
      return ThumbnailSizes.ARTICLE;
    } else if (type === 'profile') {
      return ThumbnailSizes.PROFILE;
    } else if (type === 'message') {
      return ThumbnailSizes.MESSAGE;
    } else if (type === 'business_article_thumb') {
      return ThumbnailSizes.BUSINESS_ARTICLE_THUMB;
    }
    return null;
  }
}
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

function parseCategoriesData(data) {
  return data.items.map( (item) => {
    return {
      name: item.snippet.title,
      id: item.id,
      url: item.snippet.thumbnails.medium.url,
    };
  });
}

function parseCategoryData(data) {
  return data.items.map( (item) => {
    return {
      name: item.snippet.title,
      video_id: item.snippet.resourceId.videoId,
      thumbnail_url: item.snippet.thumbnails.medium.url,
    };
  });
}

function parseS3FileList(data) {
  return data.Contents.map( (item) => {
    return {
      name: item.Key.split('/')[1],
      date: item.LastModified,
      size: item.Size,
      url: `${AWS_S3_URL}/${item.Key}`,
    };
  });
}

function destKeyFromSrcKey(key, suffix) {
    return key.replace('origin/', `resize/${suffix}/`)
}

function resizeAndUpload(response, size, srcKey, srcBucket, imageType, callback) {
    const pixelSize = size["size"];
    const resizeType = size["type"];

    function resizeWithAspectRatio(resizeCallback) {
        gm(response.Body)
            .autoOrient()
            .resize(pixelSize, pixelSize, '>')
            .noProfile()
            .quality(95)
            .toBuffer(imageType, function(err, buffer) {
                if (err) {
                    resizeCallback(err);
                } else {
                    resizeCallback(null, response.ContentType, buffer);
                }
            });
    }

    function resizeWithCrop(resizeCallback) {
        gm(response.Body)
            .autoOrient()
            .resize(pixelSize, pixelSize, '^')
            .gravity('Center')
            .extent(pixelSize, pixelSize)
            .noProfile()
            .quality(95)
            .toBuffer(imageType, function(err, buffer) {
                if (err) {
                    resizeCallback(err);
                } else {
                    resizeCallback(null, response.ContentType, buffer);
                }
            });
    }

    async.waterfall(
        [
            function resize(next) {
                if (resizeType == "crop") {
                    resizeWithCrop(next)
                } else {
                    resizeWithAspectRatio(next)
                }
            },
            function upload(contentType, data, next) {
                const destKey = destKeyFromSrcKey(srcKey, size["alias"]);
                s3.putObject(
                    {
                        Bucket: srcBucket,
                        Key: destKey,
                        ACL: 'public-read',
                        Body: data,
                        ContentType: contentType
                    },
                    next
                );
            }
        ], (err) => {
            if (err) {
                callback(new Error(`resize to ${pixelSize} from ${srcKey} : ${err}`));
            } else {
              callback(null);
            }
        }
    )
}

// module function : hello
module.exports.hello = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'yes!',
    }),
  };

  callback(null, response);
};

// module function : categories
module.exports.categories = (event, context, callback) => {
  const requestCategoriesURL = makeCategoriesRequestURL(REQUEST_URL_CATEGORIES, CHANNEL_ID);

  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: requestCategoriesURL,
    }),
  };
  
  fetchRequest(requestCategoriesURL)
    .then(parseCategoriesData)
    .then( (data) => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          list: data,
        })
      });
  });
  
};

// module function : category
module.exports.category = (event, context, callback) => {
  const categoryId = event.queryStringParameters.id;
  const requestCategoryURL = makeCategoryRequestURL(REQUEST_URL_CATEGORY, categoryId);
  
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: requestCategoryURL,
    }),
  };
  
  fetchRequest(requestCategoryURL)
    .then(parseCategoryData)
    .then( (data) => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          list: data,
        })
      });
  });
};

// module function : images
module.exports.images = (event, context, callback) => {

	s3.listObjects({
		Bucket: 'godori-images',
		Prefix: 'origin/'
	}).on('success', function handlePage(response) {
		
	    if (response.hasNextPage()) {
	        response.nextPage().on('success', handlePage).send();
	    }
	    
		callback(null, {
			statusCode: 200,
			body: JSON.stringify({
				list: parseS3FileList(response.data),
			})
		});
	}).send();
};

// module function : createThumbnail
module.exports.createThumbnail = (event, context, callback) => {
	
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  
  const timeout = setTimeout(() => {
      callback(new Error(`[FAIL]:${bucket}/${key}:TIMEOUT`));
  }, context.getRemainingTimeInMillis() - 500);

  if (!key.startsWith('origin/')) {
      clearTimeout(timeout);
      callback(new Error(`[FAIL]:${bucket}/${key}:Unsupported image path`));
      return;
  }

  const params = {
      Bucket: bucket,
      Key: key
  };
  const keys = key.split('.');
  const imageType = keys.pop().toLowerCase();
  if (!supportImageTypes.some((type) => { return type == imageType })) {
      clearTimeout(timeout);
      callback(new Error(`[FAIL]:${bucket}/${key}:Unsupported image type`));
      return;
  }

  async.waterfall(
      [
          function download(next) {
              s3.getObject(params, next);
          },
          function transform(response, next) {
              let sizes = ThumbnailSizes.sizeFromKey(key);
              if (sizes == null) {
                next(new Error(`thumbnail type is undefined(allow articles or profiles), ${key}`));
                return;
              }
              async.eachSeries(sizes, function (size, seriesCallback) {
                  resizeAndUpload(response, size, key, bucket, imageType, seriesCallback);
              }, next);
          }
      ], (err) => {
          if (err) {
              clearTimeout(timeout);
              callback(new Error(`[FAIL]:${bucket}/${key}:resize task ${err}`));
          } else {
              clearTimeout(timeout);
              callback(null, "complete resize");
          }
      }
  );
}