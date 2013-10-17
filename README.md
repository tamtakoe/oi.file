oi.file — AngularJS file uploader
=======

☛ [Русская документация](https://github.com/tamtakoe/oi.file/wiki/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B0%D1%8F-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F)

## Key features

* File selection from explorer/finder and by drag'n'drop
* Validation
* Image upload before posting to server (if browser supports FileReader)
* Image upload via xhr and iframe (for older browsers)
* Files data are embedded into a model, but can be read separately
* Files are uploaded using POST method, each request per file
* For AngularJS 1.2+, but there is `oi.file.old.js` for old versions

[Demo](http://tamtakoe.ru/uploader/), [sandbox](http://plnkr.co/edit/HKbvgle4zqfqCKcpLJDi?p=preview)

## Usage

Angular module dependency:
```javascript
angular.module('myApp', ['oi.file']);
```

As a directive:
```html
<!-- Uploading via explorer/finder -->
<input type="file" oi-file="options">

<!-- Uploading by dragging into drop area -->
<ul oi-file="options">
  <li ng-repeat="item in items">
    <img ng-src="{{item.thumb}}"> 
  </li>
</ul>
```
*By the way, you can drop right onto the select files button*

File upload setup in controller:
```javascript
$scope.file = {} //Model
$scope.options = {
  //Called for each selected file
  change: function (file) {
      //file contains info about the uploaded file
      //uploading to server
      file.$upload('uploader.php', $scope.file)
    })
  }
}
```

Creating model element for each file
```javascript
$scope.items = model
$scope.options = {
  change: function (file) {
    //Creating empty element for future file
    $scope.add(function (i, id) {
    
      //Uploading the file via FileReader before main server post
      file.$preview($scope.items[i]);
      
      //Uploading the file
      file.$upload('uploader.php' + id, $scope.items[i], {allowedType: ["jpeg", "jpg", "png"]})
        .catch(function (data) {
          //Removing element if something goes wrong
          $scope.del(data.item.id);
        })
    })
  }
}
```
*`catch` method is available starting from Angular 1.2. If you're using older versions, then use `then(null, function (data) {...})` instead.*

`$preview` and `$upload` return promises. See [$q](http://www.angular.ru/api/ng.$q).

Third argument in `$upload` method is a validation params object.
Upload module has validation function built-in, which can be overriden.
Same way you can override the function of error handling.

Example with image resizing on client-side:
```javascript
file.$preview({})
  .then(function (data) {
    //Image is read by this moment. Resizing it with canvas
    minimize(file._file);
    //Sending
    file.$upload('uploader.php', $scope.avatar)
    
  }, function (data) {
    //Image hasn't been read. Sending as is
    file.$upload('uploader.php', $scope.avatar)
  });
```



Default settings can be overridden in a service variable `oiFileConfig`

## Setting up
- **change** `function (file)`. Getting the file object. If it is `null` - doing nothing.
    - **file** `{object}` - File object, that contains info about selected file and methods: 
       - $preview `function (item, [field])`      *item -model, field - field, where the image in `dataUrl` format is written (writing here unless specified otherwise).
                                                   Returns promises with `success`, `error` callbacks*
       - $upload `function (url, item, [permit])` *url - upload script, item - model, permit - validation settings object (see below).
                                                   Returns promises with `success`, `error`, `notice` callbacks*

       In promises' callbacks `$preview` и `$upload`  xhr is passed with additional fields: 
       `item: {...}`     *model into which the uploading is performed* and
       `response: {...}` *server response, decodeed from JSON*

- **validate** `function (file, permit)`. Files validation
    - **file** `{object}`   - file object
    - **permit** `{object}` - validation params. Example:
        - `allowedType: ["jpeg", "jpg", "png", "gif"]`, *whitelist of extensions*
        - `maxNumberOfFiles: 100`, *maximum number of files*
        - `maxSize: 4194304`,      *maximum file size*
        - `maxSpace: 104857600`,   *maximum server storage space available*
        - `quantity: 3`,           *files uploaded*
        - `space: 481208`,         *storage place taken*
        - `errorBadType: "You can upload only: JPEG, JPG, PNG, GIF"`, *Error messages...*
        - `errorBigSize: "The file is too big"`,
        - `errorMaxQuantity: "Maximum number of uploaded files exceeded: 100"`,
        - `errorMaxSize: "Only 2,3 МB of free space is left"`
    - **return** `{object}` - array of error objects `[{msg: 'error msg', code: 'код'}, {...}, ... ]`

- **setError** `function (code, data)`. Error handling
    - **code** `{string}` - error code
    - **data** `{object}` - xhr with additional fields
        - `item: {...}`,     *model, into which the uploading is performed*
        - `response: {...}`, *server response, decoded from JSON*
    - **return** `{object}` - object: `{item: model, response: errors array}`

- **url** `{string}`.          Default url to uploader script *'uploader.php'*
- **fieldName** `{string}`.    $_FILES array key *'Files'*
- **fileClass** `{string}`.    Draggable file class name *'dragover-file'*
- **notFileClass** `{string}`. Draggable non-file class name *'dragover-plain'*

Fields added to model (for each file):
- **fileName** `{string}`.      File name *'filename'*
- **fileThumb** `{string}`.     Thumbnail reference *'thumb'*,
- **fileSize** `{string}`.      File size *'size'*,
- **fileLoaded** `{string}`.    Loaded, bytes (will be removed in the end) *'loaded'*
- **fileProgress** `{string}`.  Upload percentage (will be removed in the end) *'progress'*
- **fileUploading** `{string}`. Находится ли файл в процессе загрузки *'uploading'*

Fields added to scope:
- **queue** `{string}`. Upload queue *'uploading'*. Contains a general options:
  - queue.total    - all files size, bytes
  - queue.loaded   - all files loaded, bytes
  - queue.progress - all files upload percentage
  - queue.all      - number of uploaded files
  - queue.length   - number of remaining files (native option)
