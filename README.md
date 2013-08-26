oi.file — Загрузчик файлов для AngularJS
=======


## Основные особенности

* Выбор файлов через проводник и перетаскиванием
* Валидация
* Загрузка картинки до загрузки на сервер (если браузер поддерживает FileReader)
* Загрузка файлов через xhr и iframe (для старых браузеров)
* Данные о файлах внедряются в модель, но могут быть получены отдельно
* Файлы передаются методом POST по одному запросу на каждый файл 

[Демонстрация](http://tamtakoe.ru/uploader/), [песочница](http://plnkr.co/edit/HKbvgle4zqfqCKcpLJDi?p=preview)

## Применение

Подключение модуля
```javascript
angular.module('myApp', ['oi.file']);
```

Использование директивы
```html
<!-- Загрузка через проводник -->
<input type="file" oi-file="options">

<!-- Загрузка перетаскиванием на область -->
<ul oi-file="options">
  <li ng-repeat="item in items">
    <img ng-src="{{item.thumb}}"> 
  </li>
</ul>
```
*Кстати, перетаскивать можно и на кнопку выбора файлов*

Настройка загрузчика в контроллере
```javascript
$scope.items = model //Элемент или список элементов, которые будут расширены файловыми полями
$scope.options = {
  change: function (file) {
    //Создаем пустой элемент для будущего файла
    $scope.add(function (i, id) {
    
      file.$preview($scope.items[i]); //Загружаем картинку через FileReader до загрузки
      
      file.$upload('uploader.php' + id, $scope.items[i], {allowedType: ["jpeg", "jpg", "png", "gif"]})
        .catch(function (data) {
          //Удаляем элемент при неудачной загрузке
          $scope.del($scope.getIndexById(data.item.id));
        })
    })
  }
}```
*Метод catch доступен, начиная с Ангуляра 1.2. В старых версиях используйте вместо него then(null, function (data) {...})*

$preview и $upload возвращают обещания. См. [$q](http://www.angular.ru/api/ng.$q)

Пример с уменьшением изображения на клиенте
```javascript
$scope.items = model //Элемент или список элементов, которые будут расширены файловыми полями
$scope.options = {
  change: function (file) {
    //Создаем пустой элемент для будущего файла
    $scope.add(function (i, id) {
    
      file.$preview($scope.items[i])
        .then(function (data) {
          //Изображение прочитано. Уменьшаем его с помощью canvas
          minimize(file._file);
          //Отправляем
          file.$upload('uploader.php' + id, $scope.items[i])
          
        }, function (data) {
          //Изображение не прочитано. Отправляем как есть
          file.$upload('uploader.php' + id, $scope.items[i])
        });
    })
  }
}```

Третим параметром в методе $upload идет объект с параметрами валидации.
Модуль загрузки имеет встроенную функцию валидации, которую можно переопределить.
Аналогично можно переопределить функцию обработки ошибок.

Настроку по умолчанию можно переопределить в сервисе-переменной `oiFileConfig`

## АПИ
- **change** `function (file)`. Получение объекта файла. Если null — не обрабатывается
    - **file** `{object}` - объект файла, содержащий информацию о выбранном файле и методы:
       - $preview `function (item, [field])`     //item - модель, field - поле с миниатюрой, которое добавится в модель (если не указано, берется по умолчанию)
                                                //Возвращает обещание с колбеками: success, error
       - $upload `function (url, item, [permit])` //url - скрипт загрузки, item - модель (можно указать {}), permit - объект параметров валидации (см. ниже)
                                                //Возвращает обещание с колбеками: success, error, notice

В колбеки обещания передается xhr (или макет, при загрузке через iframe), дополненный полями:
item: {...}     //модель, в которую осуществлялась загрузка
response: {...} //ответ сервера, раскодированный из JSON

- **validate** `function (file, permit)`. Валидация файлов
    - **file** `{object}`   - объект файла
    - **permit** `{object}` - параметры для валидации. Пример:
        - allowedType: ["jpeg", "jpg", "png", "gif"], //список разрешенных расширений
        - maxNumberOfFiles: 100, //максимальное количество файлов
        - maxSize: 4194304,      //максимальный размер файла
        - maxSpace: 104857600,   //максимально доступное место на сервере
        - quantity: 3,           //загружено файлов
        - space: 481208,         //занято места
        - errorBadType: "Можно загружать: JPEG, JPG, PNG, GIF", //Фразы ошибок...
        - errorBigSize: "Вес не более 4 МБ",
        - errorMaxQuantity: "Загружено максимальное количество файлов: 100",
        - errorMaxSize: "Осталось 2,3 МБ свободного места"
    - *return* `{object}` - массив объектов ошибок [{msg: 'текст ошибки', code: 'код'}, {...}, ... ]

- **setError** `function (code, data)`. Обработка ошибок
    - **code** `{string}` - код ошибки
    - **data** `{object}` - xhr (или макет, при загрузке через iframe), дополненный полями:
        - item: {...}     //модель, в которую осуществлялась загрузка
        - response: {...} //ответ сервера, раскодированный из JSON

- **url** `{string}`.          Путь по умолчанию до скрипта загрузки
- **fieldName** `{string}`.    Ключ в массиве $_FILES - 'Files'
- **fileClass** `{string}`.    Имя класса, если перетаскивается файл - 'dragover-file'
- **notFileClass** `{string}`. Имя класса, если перетаскивается не файл - 'dragover-plain'

Имена полей, добавляемых в модель
- **fileName** `{string}`.     Имя файла - 'filename'
- **fileThumb** `{string}`.    Ссылка на миниатюру - 'thumb',
- **fileSize** `{string}`.     Размер файла - 'size',
- **fileProgress** `{string}`. Процент загрузки (в конце это поле удалится) - 'progress'