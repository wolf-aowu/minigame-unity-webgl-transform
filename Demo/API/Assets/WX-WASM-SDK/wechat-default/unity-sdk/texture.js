import canvasContext from "./canvas-context";
const downloadedTextures = {};
const downloadingTextures = {};
const downloadFailedTextures = {};

let hasCheckSupportedExtensions = false;
//不让外部使用
if (typeof window != 'undefined' && window.indexedDB) {
  Object.defineProperty(window, 'indexedDB', {
    get() { return; },
    set() {},
    enumerable: true,
    configurable: true
  });
}
const err = function(msg) { GameGlobal.manager.printErr(msg) };
const PotList = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

const UseDXT5 = "$UseDXT5$";

let isStopDownloadTexture = false;
let cachedDownloadTask = [];
wx.stopDownloadTexture = function() {
  isStopDownloadTexture = true;
}

wx.starDownloadTexture = function() {
  isStopDownloadTexture = false;
  while (cachedDownloadTask.length > 0) {
    var task = cachedDownloadTask.shift();
    mod.WXDownloadTexture(task.path, task.width, task.height, task.callback, task.limitType);
  }
}

const mod = {
  getSupportedExtensions() {
    if (hasCheckSupportedExtensions) {
      return GameGlobal.TextureCompressedFormat;
    }
    const list = canvas.getContext(GameGlobal.managerConfig.contextConfig.contextType == 2 ? 'webgl2' : 'webgl').getSupportedExtensions();

    const noneLimitSupportedTextures = [ '' ];  //兜底采用png
    GameGlobal.TextureCompressedFormat = '';
    if (list.indexOf('WEBGL_compressed_texture_s3tc') !== -1 && UseDXT5){
      GameGlobal.TextureCompressedFormat = 'dds';
    }
    if (list.indexOf('WEBGL_compressed_texture_pvrtc') !== -1){
      GameGlobal.TexturePVRTCSupported = true;
      GameGlobal.TextureCompressedFormat = 'pvr';
    }
    if (list.indexOf('WEBGL_compressed_texture_etc') !== -1){
      GameGlobal.TextureEtc2Supported = true;
      noneLimitSupportedTextures.push('etc2');
      GameGlobal.TextureCompressedFormat = 'etc2';
    }
    if (list.indexOf('WEBGL_compressed_texture_astc') !== -1){
      noneLimitSupportedTextures.push('astc');
      GameGlobal.TextureCompressedFormat = 'astc';
    }
    /*else if(list.indexOf('WEBGL_compressed_texture_etc1')!==-1){ //ect1不支持透明通道，先屏蔽
                GameGlobal.TextureCompressedFormat = 'etc1';
            }*/
    hasCheckSupportedExtensions = true;
    GameGlobal.NoneLimitSupportedTexture = noneLimitSupportedTextures.pop();
    return GameGlobal.TextureCompressedFormat;
  },
  getRemoteImageFile(path, width, height, limitType) {
    let textureFormat = GameGlobal.TextureCompressedFormat;
    if(textureFormat && limitType){
      textureFormat = GameGlobal.NoneLimitSupportedTexture;
    }
    if (!textureFormat || (textureFormat == 'pvr' && (width != height || PotList.indexOf(width) === -1)) || (textureFormat == 'dds' && (width % 4 !== 0 || height % 4 !== 0))) {
      mod.downloadFile(path, width, height)
    } else {
      mod.requestFile(path, width, height, textureFormat, limitType);
    }
  },
  reTryRemoteImageFile(path, width, height, limitType) {
    var cid = path;
    if (!downloadFailedTextures[cid]) {
      downloadFailedTextures[cid] = {
        count: 0,
        path,
        width,
        height,
        limitType,
      };
    }
    if (downloadFailedTextures[cid].count > 4) {
      return;
    }

    setTimeout(() => {
      mod.getRemoteImageFile(path, width, height,limitType)
    }, Math.pow(2, downloadFailedTextures[cid].count) * 250);

    downloadFailedTextures[cid].count++;
  },
  requestFile(path, width, height, format, limitType) {
    var cid = path;
    var url = GameGlobal.manager.assetPath.replace(/\/$/, '') + '/Textures/' + format + '/' + width + "/" + path + '.txt';
    var xmlhttp = new GameGlobal.unityNamespace.UnityLoader.UnityCache.XMLHttpRequest();
    xmlhttp.responseType = 'arraybuffer';
    xmlhttp.open("GET", url, true);
    xmlhttp.onload = function() {
      let res = xmlhttp;
      if (res.status === 200) {
        downloadedTextures[cid] = {
          data: res.response,
          tmpFile: ''
        };
        if (downloadingTextures[cid] instanceof Array) {
          downloadingTextures[cid].forEach(v => v());
        } else {
          downloadingTextures[cid] && downloadingTextures[cid]();
        }

        delete downloadingTextures[cid];
        delete downloadFailedTextures[cid];
        delete downloadedTextures[cid].data;
      } else {
        //   err("压缩纹理下载失败！url:"+url);
        mod.reTryRemoteImageFile(path, width, height, limitType);
      }
    };
    xmlhttp.onerror = function() {
      //   err("压缩纹理下载失败！url:"+url);
      mod.reTryRemoteImageFile(path, width, height, limitType);
    }
    xmlhttp.send(null);
  },
  callbackPngFile(path, cid) {
    var image = wx.createImage();
    image.crossOrigin = '';
    image.src = path;
    image.onload = function() {
      downloadedTextures[cid] = {
        data: image,
        tmpFile: ''
      };
      if (downloadingTextures[cid] instanceof Array) {
        downloadingTextures[cid].forEach(v => v());
      } else {
        downloadingTextures[cid] && downloadingTextures[cid]();
      }
      delete downloadingTextures[cid];
      delete downloadFailedTextures[cid];
      delete downloadedTextures[cid];
    };
    image.onerror = function() {
      mod.reTryRemoteImageFile(path, width, height, false);
    };
  },
  callbackPngFile(path, cid) {
    var image = wx.createImage();
    image.crossOrigin = '';
    image.src = path;
    image.onload = function() {
      downloadedTextures[cid] = {
        data: image,
        tmpFile: ''
      };
      if (downloadingTextures[cid] instanceof Array) {
        downloadingTextures[cid].forEach(v => v());
      } else {
        downloadingTextures[cid] && downloadingTextures[cid]();
      }
      delete downloadingTextures[cid];
      delete downloadFailedTextures[cid];
      delete downloadedTextures[cid];
    };
  },
  downloadFile(path, width, height) {
    var url = GameGlobal.manager.assetPath.replace(/\/$/, '') + '/Textures/png/' + width + "/" + path + '.png';
    var cid = path;
    var cache = GameGlobal.manager.getCachePath(url);
    if (cache) {
      mod.callbackPngFile(cache, cid);
    } else {
      if(GameGlobal.unityNamespace.needCacheTextures){
        var xmlhttp = new GameGlobal.unityNamespace.UnityLoader.UnityCache.XMLHttpRequest();
        xmlhttp.responseType = 'arraybuffer';
        xmlhttp.open("GET", url, true);
        xmlhttp.onsave = function(path){
          mod.callbackPngFile(path, cid);
        }
        xmlhttp.onerror = function() {
          mod.reTryRemoteImageFile(path, width, height);
        }
        xmlhttp.send(null);
      }else{
        var image = wx.createImage();
        image.crossOrigin = '';
        image.src = url;
        image.onload = function () {
          downloadedTextures[cid] = {
            data:image,
            tmpFile:''
          };
          if(downloadingTextures[cid] instanceof Array){
            downloadingTextures[cid].forEach(v=>v());
          }else{
            downloadingTextures[cid] && downloadingTextures[cid]();
          }
          delete downloadingTextures[cid];
          delete downloadFailedTextures[cid];
          delete downloadedTextures[cid];
        };
        image.onerror = function(){
          mod.reTryRemoteImageFile(path,width,height);
        };
      }
    }
  },
  readFile(textureId, callback, width, height) {
    var cid = textureId;
    const fileManager = wx.getFileSystemManager();
    const filePath = wx.env.USER_DATA_PATH + "/" + cid + '.txt';
    fileManager.readFile({
      filePath,
      success(res) {
        if (!GameGlobal.TextureCompressedFormat) {
          var image = wx.createImage();
          image.src = filePath;
          image.onload = function() {
            handleLoaded(image);
            delete downloadedTextures[cid];
          }
        } else {
          handleLoaded();
          delete downloadedTextures[cid].data;
        }

        function handleLoaded(image) {
          downloadedTextures[cid] = {
            data: image || res.data,
            tmpFile: filePath
          };
          callback();
        }
      },
      fail(err) {
        err(err, "读取压缩纹理失败！id:" + cid);
        handleError();
      }
    });


    function handleError() {
      var path;
      if (type === "Texture") {
        path = GameGlobal.TextureConfig[textureId].p;
      } else {
        path = GameGlobal.SpriteAtlasConfig[textureId].p;
      }
      if (downloadingTextures[cid]) {
        downloadingTextures[cid].push(callback);
      } else {
        downloadingTextures[cid] = [callback];
      }
      mod.getRemoteImageFile(textureId, type, path.replace(/\\/g, '/'), width, height);
    }
  },
  WXDownloadTexture(path, width, height, callback,limitType = false) {
    var width4m = width % 4;
    if (width4m !== 0) {
      width += (4 - width4m);
    }
    if (!hasCheckSupportedExtensions) {
      mod.getSupportedExtensions();
    }
    var cid = path;
    /*
    if(downloadedTextures[cid]){
        if(downloadedTextures[cid].data){
            callback();
        }else{
            mod.readFile(id,type,callback,width,height);
        }
    }else */
    if (isStopDownloadTexture) {
      cachedDownloadTask.push({
        path,
        width,
        height,
        callback,
        limitType,
      });
      return;
    }
    if (downloadingTextures[cid]) {
      downloadingTextures[cid].push(callback);
    } else {
      downloadingTextures[cid] = [callback];
      mod.getRemoteImageFile(path, width, height, limitType);
    }
  }
};

GameGlobal.DownloadedTextures = downloadedTextures;
GameGlobal.TextureCompressedFormat = ''; //支持的压缩格式

GameGlobal.ParalleLDownloadTexture = function(filename) {
  filename = filename.replace(GameGlobal.managerConfig.DATA_CDN, '').replace(/^\//, '');
  filename = "/" + filename;
  if (GameGlobal.TEXTURE_BUNDLES[filename]) {
    GameGlobal.TEXTURE_BUNDLES[filename].forEach(function(v) {
      var f = GameGlobal.TextureCompressedFormat;
      if (!f) {
        var p = GameGlobal.manager.assetPath + '/Textures/png/' + v.w + '/' + v.p + '.png';
        var image = wx.createImage();
        image.crossOrigin = '';
        image.src = p
      } else if (f != 'pvr') {
        var http = new GameGlobal.unityNamespace.UnityLoader.UnityCache.XMLHttpRequest();
        var p = GameGlobal.manager.assetPath + '/Textures/' + f + '/' + v.w + '/' + v.p + '.txt';
        http.open('GET', p, true);
        http.responseType = 'arraybuffer';
        http.send()
      }
    })
  }
}


export default {
  WXDownloadTexture: mod.WXDownloadTexture
}


canvasContext.addCreatedListener(() => {
  if (GameGlobal.USED_TEXTURE_COMPRESSION) {
    mod.getSupportedExtensions();
    if (GameGlobal.TextureCompressedFormat == '' || GameGlobal.TextureCompressedFormat == "pvr") {
      wx.getSystemInfo({
        success(res) {
          if (res.platform == 'ios') {
            wx.showModal({
              title: '提示',
              content: "当前操作系统版本过低，建议您升级至最新版本。",
            });
          }
        }
      });
    }
  }
  wx.onNetworkStatusChange(function(res) {
    if (res.isConnected) {
      for (var key in downloadFailedTextures) {
        var v = downloadFailedTextures[key];
        if (v.count > 4) {
          mod.getRemoteImageFile(v.path, v.width, v.height, v.limitType)
        }
      }
    }
  });
});