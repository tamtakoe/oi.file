'use strict';

/** 
* oi.file v.1.2
* https://github.com/tamtakoe/oi.file
* Oleg Istomin 2013
*
* Licensed under the MIT license:
* http://www.opensource.org/licenses/MIT
*/

angular.module('oi.file', [])

  //Default settings
  .value('oiFileConfig', {
  
    //Processing of selected files
    change: function (file) {
      //Uploading after addition by default
      //По умолчанию загружаем файл сразу после добавления
      file.$upload(this.url, {});
    },
    
    //Validate
    validate: function (file, permit) {

      var errors = [];
      
      if (typeof permit === 'object') {
      
        if (permit.allowedType === null || permit.allowedType.indexOf(file[this.fileName].toLowerCase().split(".").pop()) === -1) {
            errors.push({msg: permit.errorBadType, code: 'type'});
        }
        if (file[this.fileSize] > (+permit.maxSize ? permit.maxSize : Infinity)) {
            errors.push({msg: permit.errorBigSize, code: 'size'});
        }
        if (file[this.fileSize] > (+permit.maxSpace ? permit.maxSpace: Infinity) - permit.space) {
            errors.push({msg: permit.errorMaxSize, code: 'full'});
        }
        if (permit.maxNumberOfFiles && permit.quantity >= permit.maxNumberOfFiles) {
            errors.push({msg: permit.errorMaxQuantity, code: 'quantity'});
        }
      }
      return errors.length ? errors : false;
    },
    
    //Error handle
    setError: function (code, data) {
      
      var response = data.data;
      var errors = response ? response.error ? [response.error] : response : [];

      if (!errors.length) {
        switch (code) {
          case 'drop'    : errors.push({msg: 'Drag and drop is not supported. Upgrade your browser', code: code}); break;
          case 'validate': errors.push({msg: 'The file is invalid', code: code});                                  break;
          case 'preview' : errors.push({msg: 'Thumbnails are not supported. Upgrade your browser', code: code});   break;
          case 'load'    : errors.push({msg: 'Unable to load file. No connection to the Internet', code: code});   break;
          case 'upload'  : errors.push({msg: 'Unable to load file. Server problem', code: code});                  break;
          case 'abort'   : errors.push({msg: 'Download aborted', code: code});                                     break;
        }
      }
      if (data.item[this.fileLoaded]) {
        delete data.item[this.fileLoaded];
        delete data.item[this.fileProgress];
        delete data.item[this.fileUploading];
      }
      return {item: data.item, response: errors};
    },
    
    //Options
    url:           'uploader.php',  //Download script
    fieldName:     'Files',         //Key in $_FILES array
    fileClass:     'dragover-file', //Draggable file class name
    notFileClass:  'dragover-plain',//Draggable non-file class name

    //Fields added to the model
    fileName:      'filename',
    fileThumb:     'thumb',
    fileSize:      'size',
    fileLoaded:    'loaded',
    fileProgress:  'progress',
    fileUploading: 'uploading',
    
    //Fields added to the scope
    queue: 'uploading' //Uploading queue. Contains a general options:
                       // queue.total    - all files size, bytes
                       // queue.loaded   - all files loaded, bytes
                       // queue.progress - all files upload percentage
                       // queue.all      - number of uploaded files
                       // queue.lenght   - number of remaining files (native option)
  })
  
  .directive('oiFile', ['oiFileConfig', '$q', '$compile', '$timeout', function (oiFileConfig, $q, $compile, $timeout) {
  
    //Uploading queue. Taken out separately, because it make files downloading easy and solves the problem of circular references to xhr
    //Очередь файлов для загрузки. Вынесена отдельно, т.к. упрощает поочередную загрузку фалов и решает проблему циклических ссылок на xhr
    var queue = [];
    
    return {
      link: function (scope, element, attrs) {
    
        //Reading settings
        var opts = {};
        
        angular.extend(opts, oiFileConfig);
        
        scope.$watch(attrs.oiFile, function (newVal, oldVal) {
          opts = angular.extend({}, oiFileConfig, newVal);
        }, true);
        
        scope[opts.queue] = queue;

        //Drag and drop files onto the area
        element
          .bind('drop', function(e) {
            var dataTransfer = e.dataTransfer ? e.dataTransfer : e.originalEvent.dataTransfer; // jQuery fix;
            
            e.stopPropagation();
            e.preventDefault();

            dataTransfer.files ? _add(dataTransfer.files) : opts.setError('drop');
            
            element.removeClass(opts.fileClass + ' ' + opts.notFileClass);
          })
          
          .bind('dragover', function(e) {
            var dataTransfer = e.dataTransfer ? e.dataTransfer : e.originalEvent.dataTransfer; // jQuery fix;

            e.stopPropagation();
            e.preventDefault();  
            dataTransfer.dropEffect = 'copy';
            
            //Check that you drag the file
            //Проверяем, что перетаскиваются именно файлы
            if (dataTransfer && dataTransfer.types) {
                if (dataTransfer.types instanceof Array) {
                    dataTransfer.types.indexOf('Files') >= 0 ? element.addClass(opts.fileClass) : element.addClass(opts.notFileClass);
                } else {
                    //fix for Firefox (because dataTransfer.types is a DOMStringList)
                    dataTransfer.types.contains('Files') ? element.addClass(opts.fileClass) : element.addClass(opts.notFileClass);
                }
            }
          })
          
          .bind('dragleave', function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            element.removeClass(opts.fileClass + ' ' + opts.notFileClass);
          })
        
        //Selecting files in the dialog (input type="file")
          .bind('change', function () {
            _add(this.files ? this.files : this);
            //_add(this); //to check the download via iframe
          });
          
        //Adding files to the download queue
        function _add(files) {
          if (typeof opts.change === 'function') {
            //iframe fix for old browsers
            if (angular.isElement(files)) {
              var input = angular.element(files),
                  form = angular.element('<form style="display: none;" />'),
                  iframe = angular.element('<iframe src="javascript:false;" name="iframeTransport' + +new Date() + '">');
              var clone = $compile(input.clone())(scope),
                  value = input.val();
              
              files = [{
                lastModifiedDate: null,
                size: null,
                type: 'like/' + value.replace( /^.+\.(?!\.)|.*/, '' ),
                name: value.match( /[^\\]+$/ )[0],
                _form: form
              }];
              
              input.after(clone).after(form);
              form.append(input).append(iframe);
            }
            
            scope.$apply(function (scope) {
              for (var i = 0, n = files.length; i < n; i++) {
                //Create a file object to be combined with a model
                //Создаем объект файла для объединения с моделью
                var file = {
                  $upload: _upload,
                  $preview: _preview,
                  $abort: _abort,
                  _file: files[i]
                };
                file[opts.fileName]      = files[i].name;
                file[opts.fileThumb]     = files[i].thumb;
                file[opts.fileSize]      = files[i].size;
                file[opts.fileLoaded]    = 0;
                file[opts.fileProgress]  = 0;
                file[opts.fileUploading] = true;

                //Pass each file into a function that uploads it
                //Передаем каждый файл в функцию, которая отправит его на загрузку
                opts.change(file);
              }
            });
          }
        }
        
        //Files preview
        function _preview (item, thumb) {
          var previewDeferred = $q.defer(),
              data = {item: item, response: {}};
              
          thumb = thumb ? thumb : opts.fileThumb;

          if (window.FileReader !== null) {
            var reader = new FileReader();
            
            reader.onload = (function (image) {
              return function (event) {
                if (event.target.result.indexOf('data:image') !== -1) {
                  scope.$apply(function(){
                    //If the file is read
                    //Если файл прочитан
                    item[thumb] = reader.result;
                    data.response[thumb] = reader.result;
                    
                    previewDeferred.resolve(data);
                  });
                }
              };
            })(this);
            reader.readAsDataURL(this._file);
            
          } else if (typeof opts.preview === 'function') {
            //Reading files is not supported
            //Чтение файлов не поддерживается
            previewDeferred.reject(opts.setError('preview', {item: item, response: null}))
          }
          
          return previewDeferred.promise;
        }
                   
        //Download files     
        function _upload (url, item, permit) {
        
          var uploadDeferred = $q.defer();

          item = angular.extend(item, this);
          delete item.$upload;
          delete item.$preview;

          var errors = opts.validate(item, permit);
          
          if (errors) {
            uploadDeferred.reject(opts.setError('validate', {item: item, data: errors}));
            return uploadDeferred.promise;
          }
          
          //Collect all the necessary data to load into a single object and place it in the queue
          //Собираем все необходимые для загрузки данные в один объект и помещаем его в очередь
          var uploadObject = {
            url:      url,
            item:     item,
            deferred: uploadDeferred,
            xhr: undefined //reference to xhr store in queue, but not in the file model (item), to avoid circular references, because xhr contains a reference to item
                           //ссылку на xhr храним в очереди, а не в модели файла (item), чтобы избежать циклической ссылки, т.к. в xhr хранится ссылка на item
                           //otherwise, an error: //иначе возникает ошибка: (Error: An attempt was made to use an object that is not, or is no longer, usable.)
          }
          queue.push(uploadObject);
          
          //Start downloading the addition of the first file (until download is completed the rest of the items will be added to the same queue, or will create a new queue)
          //Начинаем загрузку при добавлении первого файла (пока загрузка не завершена остальные элементы будут добавляться в эту же очередь, иначе создастся новая очередь)
          if (queue.length === 1) {
            queue.total    = item[opts.fileSize];
            queue.loaded   = 0;
            queue.progress = 0;
            queue.all      = 1;
            
            _uploadQueue();
            
          } else {
            queue.total += item[opts.fileSize];
            queue.all++;
          }
          
          //Download the following file starts when the previous loaded or aborted
          //Загрузка следующего файла начинается когда предыдущий загружен либо отменен
          function _uploadQueue () {
            if (queue.length) {
            
              queue[0].item._file._form ? _iframeTransport(queue[0]) : _xhrTransport(queue[0]);
              
              queue[0].deferred.promise.finally(function () { //for AngularJS 1.2. Use all instead of finally in old versions
                //Delete this and move on to the next element in the queue in case the download is complete or an error (including due to cancellation)
                //Удаляем этот и переходим к следующему элементу очереди в случае завершения загрузки или ошибки (в т. ч. из-за отмены)
                queue.shift();
                _uploadQueue();
              })
            } else {
              //Clear the queue when all files have been uploaded
              //Обнуляем очередь когда все файлы загружены
              delete queue.total;
              delete queue.loaded;
              delete queue.all;
              delete queue.progress;
            }
          }
          
          return uploadDeferred.promise;
        }
        
        //Cancel download
        function _abort () {
          //forEach is used for the closure for transmission each element value in setTimeout
          //forEach используется для организации замыкания для передачи каждого элемента value в setTimeout
          angular.forEach(queue, function (value, key) {
            if (value.item === this) {
              if (value.xhr) {
                //If you call abort without setTimeout, you get error: apply already in progress
                //Если запустить abort напрямую возникает ошибка: apply already in progress
                setTimeout(function () {
                  value.xhr.abort();
                }, 0)
              } else {
                //Remove the element from the queue that has not yet started to upload
                //Удаляем из очереди элемент, который еще не начал загружаться
                queue.splice(key, 1);
              }
              queue.total -= value.item[opts.fileSize];
              queue.loaded -= value.item[opts.fileLoaded];
              queue.all--;  
            }
          }, this)
        }
        
        //xhr-transport
        function _xhrTransport (uObj) {
      
          var xhr = new XMLHttpRequest(),
              form = new FormData();
              
          xhr.item = uObj.item;
          uObj.xhr = xhr;
          
          form.append(opts.fieldName, uObj.item._file, uObj.item.filename);
          
          xhr.upload.addEventListener('progress', function (e) {
            
            scope.$apply(function () {
              //Calculate the file upload progress
              uObj.item[opts.fileLoaded]   = e.lengthComputable ? e.loaded : undefined;
              uObj.item[opts.fileProgress] = e.lengthComputable ? Math.round(e.loaded * 100 / e.total) : undefined;
              
              //Calculate the overall progress of downloading all files
              queue.loaded += uObj.item[opts.fileLoaded];
              queue.progress = Math.round(queue.loaded * 100 / queue.total);
              xhr.data = e;
              
              uObj.deferred.notify(xhr); //Work with AngularJS 1.2. Not use for old versions
            });
          }, false);

          xhr.addEventListener('load', function () {
                  
            var response = xhr.data = _parseJSON(xhr.responseText);
            
            //remove technical information about uploaded file from the model
            delete uObj.item._file;
            delete uObj.item.$abort;
            delete uObj.item[opts.fileProgress];
            delete uObj.item[opts.fileLoaded];
            delete uObj.item[opts.fileUploading];
            
            scope.$apply(function () {
              if (xhr.status === 200 && response) {
                angular.extend(uObj.item, response);
                uObj.deferred.resolve(xhr);
                
              } else {
                uObj.deferred.reject(opts.setError('upload', xhr));
              }
            });
          }, false);

          xhr.addEventListener('error', function () {
            xhr.data = _parseJSON(xhr.responseText);
            
            scope.$apply(function () {
              uObj.deferred.reject(opts.setError('load', xhr));
            });
          }, false);

          xhr.addEventListener('abort', function () {
            xhr.data = _parseJSON(xhr.responseText);
            
            scope.$apply(function () {
              uObj.deferred.reject(opts.setError('abort', xhr));
            });
          }, false);

          xhr.open('POST', uObj.url, true);
          
          angular.forEach( uObj.item._file.headers, function (value, name) {
            xhr.setRequestHeader(name, value);
          });
          
          xhr.send(form);
        }

        //iframe-transport
        function _iframeTransport (uObj) {
          
          uObj.xhr = false;
          
          var form = uObj.item._file._form,
              iframe = form.find('iframe'),
              input = form.find('input');

          input.prop('name', opts.fieldName);

          form.prop({
            action: uObj.url,
            method: 'post',
            target: iframe.prop('name'),
            enctype: 'multipart/form-data',
            encoding: 'multipart/form-data' // old IE
          });

          iframe.bind('load', function () {
            var response, rawResponse;
            // Wrap in a try/catch block to catch exceptions thrown
            // when trying to access cross-domain iframe contents:
            try {
              response = iframe.contents();
              // Google Chrome and Firefox do not throw an
              // exception when calling iframe.contents() on
              // cross-domain requests, so we unify the response:
              if (!response.length || !response[0].firstChild) throw new Error();
              
              rawResponse = angular.element(response[0].body).text();
              response = _parseJSON(rawResponse);
            } catch (e) {}
            
            form.remove(); //Remove hidden form
            delete uObj.item._file; //remove technical information about uploaded file from the model

            scope.$apply(function () {
              if (response && !response.error) {
                //It is impossible to know the status of loading into the frame, so we now if error when response contans error parameter
                //Нельзя узнать статус загрузки во фрейм, поэтому ошибка определяется наличием параметра error в ответе
                angular.extend(uObj.item, response);
                uObj.deferred.resolve({item: uObj.item, response: response});

              } else {
                uObj.deferred.reject(opts.setError('upload', {responseText: rawResponse, data: response, item: uObj.item, dummy: true}));
              }
            });
          });
          
          form[0].submit();
        }
        
        //Parse JSON
        function _parseJSON (data) {
        
          if (typeof data !== 'object') {
            try {
              return angular.fromJson(data);
            } catch (e) {
              return false;
            }
          }
          return data;
        }
      }
    };
  }]);