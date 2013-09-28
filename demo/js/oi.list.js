'use strict';

/** oi.list - утилиты для работы с ресурсом
* Расширение области видимости функциями для работы со списками, кеширование полученных данных и проч.
*
* oiList(scope, cacheName, resName, [emptyPosition], [options])
*
* @scope object scope      - область видимости контроллера
* @cacheName string        - имя объекта, в который закэшируются данные
* @resName object resource - ресурсный объект
* @emptyPosition string    - позиция автоматически добавляемой пустой строки: 'before' - начало, 'after' - конец списка
* @options object          - настройка списка {fields: {...}, preloader: {...}}
*   fields: {
*     fieldName1: '', //имя поля, ввод в котором создаст новое поле
*     fieldName2: [   //имя составного поля. Ввод в любом из составляющих полей создаст новое составное поле
*       {text: ''},
*       {text: ''},
*       ...
*     ],
*    ...
*  },
*  preloader: {...}  //значение модели, показываемое то тех пор пока не загрузятся данные
*/
angular.module('oi.list', [])
  .value('oiListCache', {cacheRes: {}})
  .factory('oiList', ['oiListCache', function (oiListCache) {
            
    return function (scope, url, Resource, generate, options) {

      if (typeof oiListCache.cacheRes[url] === 'undefined') oiListCache.cacheRes[url] = [];
      var dataRes = oiListCache.cacheRes[url],
          delCount = 0, //Счетчик одновременных удалений
          addCount = 0 //Счетчик одновременных добавлений

      options = (options = typeof generate === 'object' ? generate : options) !== undefined ? options : {fields: {}}
      options.fields = typeof options.fields === 'object' ? options.fields : {};

      scope.errors = [];

      //Загружаем или используем кэшированную версию
      if (angular.equals(dataRes, [])) {
        scope.items = dataRes = oiListCache.cacheRes[url] = Resource.query(function(data) {
            
          //Отменяем запись полученных данных, если обнаруживаем, что модель связана с другим экземпляром oiList
          //(чтобы данные другого экземпляра не перезаписались)
          if (scope.items === undefined || !scope.items.resName || scope.items.resName === url) {

            //Добавление пустой строки
            switch (generate) {
                case 'before': dataRes.unshift(blank()); break;
                case 'after': dataRes.push(blank());
            }
            scope.items = dataRes = oiListCache.cacheRes[url]
          }
        }, function (data) {
          setError(data.data.error, {msg: 'Невозможно загрузить список. Нет соединения с интернетом', code: 'load'});
        })

        if (options.preloader !== undefined) dataRes.push(options.preloader)

      } else {
        scope.items = dataRes;
      }
      dataRes.resName = url;
      
      scope.sort         = sort;
      scope.keyup        = keyup;
      scope.add          = add;
      scope.del          = del;
      scope.save         = save;
      scope.getIndexById = getIndexById;
      scope.setActive    = setActive;
      scope.getActive    = getActive;
      scope.move         = move;
      scope.moveLeft     = moveLeft;
      scope.moveRight    = moveRight;
      
      //Получение индекса элемента по id
      function getIndexById (id) {
        for (var i = 0, n = dataRes.length; i < n; i++) {
          if (dataRes[i].id === id) return i;
        } 
      }
      
      //Установка активного элемента
      function setActive (index) {
        index = index === undefined && this !== undefined && this.$index !== undefined ? this.$index : index;

        for (var i = 0, n = dataRes.length; i < n; i++) {
          dataRes[i]['active'] = index == i ? true : false;
        }
      }
      
      //Получение индекса активного элемента
      function getActive () {
        for (var i = 0, n = dataRes.length; i < n; i++) {
          if (dataRes[i]['active']) return i;
        }
        return false;
      }
      
      //Перемещение элемента из позиции start в позицию end
      function move (start, end) {
        dataRes.splice(end, 0, dataRes.splice(start, 1)[0]);
      }
      
      //Перемещение активного элемента влево
      function moveLeft (i) {
        i = i === undefined ? getActive() : i;
        if (i > 0) move(i, i-1);
      }
      
      //Перемещение активного элемента вправо
      function moveRight (i) {
        i = i === undefined ? getActive() : i;
        if (i < dataRes.length-1) move(i, i+1);
      }
      
      // Сохранение
      function save (index) {
        if (typeof dataRes[index].id !== 'undefined') dataRes[index].$save(null, null, function (data) {
          setError(data.data.error, {msg: 'Невозможно сохранить элемент. Нет соединения с интернетом', code: 'save'}, dataRes[newIndex]);        
        });
      }
      
      // Добавление
      function add (position, afterAdd) {
          
        addCount++
        
        position === 'before' ? dataRes.unshift(blank()) : dataRes.push(blank());

        Resource.add(function (data) {
          addCount--   
          
          //Записываем полученные айдишники в новые пустые элементы по порядку
          for (var i = 0, n = dataRes.length; i < n; i++) {
            if (typeof dataRes[i].id === 'undefined') {
              var newIndex = i;
              break;
            }
          }
          
          dataRes[newIndex].id = data.id

          if (typeof afterAdd !== 'function') {
            dataRes[newIndex].$save(null, null, function (data) {
              setError(data.data.error, {msg: 'Невозможно сохранить элемент. Нет соединения с интернетом', code: 'save'}, dataRes[newIndex]);
            });
          } else {
            afterAdd(newIndex, data);
          }
          if (!addCount) sort(); //Сохранение сортировки после добавления последнего элемента
            
        }, function (data) {
          setError(data.data.error, {msg: 'Невозможно создать элемент. Нет соединения с интернетом', code: 'add'});         

          for (var i = 0, n = dataRes.length; i < n; i++) {
            if (typeof dataRes[n-i].id === 'undefined') splice(n-i, 1) //Удаляем неудачно созданный элемент
          }                    
        })
        
        return position === 'before' ? dataRes[0]: dataRes[dataRes.length];
      }

      // Удаление
      function del (index, beforeDel) {
        delCount++
        
        index = this.$index !== undefined ? this.$index : index;
        
        if (typeof beforeDel === 'function') beforeDel(index);

        if (dataRes[index] !== undefined && dataRes[index].id !== undefined) { 
          
          //Удаление с сервера
          var delItem = dataRes[index];
          
          dataRes[index].$remove(function (data) {
            delCount--
            if (!delCount) sort(); //Сохранение сортировки после удаления последнего элемента
              
          }, function (data) {
            delCount--
            setError(data.data.error, {msg: 'Невозможно удалить элемент. Нет соединения с интернетом', code: 'del'}, delItem);
            
            dataRes.splice(index, 0, delItem); //Восстанавливаем неудачно удаленный элемент
            if (!delCount) sort(); //Сохранение сортировки после восстановления последнего элемента
          });
          
          //Удаление из данных
          dataRes.splice(index, 1);
        }
      }
      
      //Отслеживание ввода в полях для генерации элементов
      function keyup (index) {

        var n = dataRes.length,
            last = generate === 'after' ? n-1 : 0,
            prelast = generate === 'after' ? n-2 : 1;

        // Автоматическое добавление
        if (typeof generate === 'string' && !isEmpty(dataRes[last])) {
        
          if (generate === 'after') {
            dataRes.push(blank());
            prelast = n-1;
          } else {
            dataRes.unshift(blank());
            prelast = 1;
          }

          Resource.add(function (data) {
            dataRes[prelast].id = data.id
            dataRes[prelast].$save(null, null, function (data) {
                setError(data.data.error, {msg: 'Невозможно сохранить элемент. Нет соединения с интернетом', code: 'save'}, dataRes[prelast]);
            });
            sort();
          }, function (data) {
            setError(data.data.error, {msg: 'Невозможно создать элемент. Нет соединения с интернетом', code: 'add'});              
          })
        }
          
        // Автоматическое удаление
        if (typeof generate === 'string' && isEmpty(dataRes[prelast]) && typeof dataRes[prelast].id !== 'undefined') {                

          if (dataRes[prelast] !== undefined) {
          
            last = generate === 'after' ? (dataRes.pop(), n-2) : (dataRes.shift(), 0)

            dataRes[last].$remove(function (data) {
              if (dataRes[last] !== undefined && dataRes[last]['id'] !== undefined) delete dataRes[last]['id'];
              sort();
            }, function (data) {
              setError(data.data.error, {msg: 'Невозможно удалить элемент. Нет соединения с интернетом', code: 'del'}, dataRes[last]);              
            });
          }
        }
      }

      //Сохранение порядка сортировки
      function sort () {

        var sortArr = [],//айдишники в порядке расположения
            pidsArr = [] //id-элемента: id-родителя
            
        for (var i = 0, n = dataRes.length; i < n; i++) { 
          if (dataRes[i].id) sortArr.push(dataRes[i].id)
        }

        //Чтобы запросы не складывались в очередь и отправлялись сразу, используем $apply
        Resource.save(null, {sort: sortArr, pids: pidsArr}, null, function (data) {
          setError(data.data.error, {msg: 'Невозможно сохранить расположение элементов. Нет соединения с интернетом', code: 'sort'});               
        })   
        scope.$$phase || scope.$apply();
      }
      
      //Установка ошибки
      function setError (error, errorDef, item) {

        var errorObj = error ? error : errorDef;
        
        if (typeof item === 'object') {
          if (typeof item.errors !== 'object') item.errors = [];
          item.errors.push(errorObj);
        }
        scope.errors.push(errorObj);
      };
      
      //Создание пустого экземпляра ресурса
      function blank () {
        var blankItem = new Resource
        for (var field in options.fields) {
          blankItem[field] = angular.copy(options.fields[field])
        }
        return blankItem
      }
      
      //Проверка строки на пустоту для всех языков
      function isEmpty (input) {  
        if (input !== undefined) {
          for (var field in options.fields) {
            if (typeof input[field] == 'object') {
              for (var j = 0, m = input[field].length; j < m ; j++) {
                if (input[field][j].text !== '') return false;
              }
            } else {
              if (input[field] !== '') return false;
            }
          }
          return true;
        }
      }
      
      //Чтобы сделать доступным извне метод $then
      return dataRes;
    }
  }])