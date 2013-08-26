<?php
$headers = GetAllHeaders(); 

//Заголовки для кроссдоменных запросоы
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS'); 
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With'); 

//Подключаемся к БД
mysql_connect("localhost", "root", "");
mysql_select_db("test");
mysql_query("SET NAMES 'UTF8'");


$r = json_decode(trim(file_get_contents('php://input')),1);


$url = substr($_SERVER['REQUEST_URI'],strrpos($_SERVER['SCRIPT_NAME'],'/') + 1);
list($url,$params) = explode('?',$url,2);

$method = $_SERVER['REQUEST_METHOD'];
list($script, $section, $id, $action) = explode('/', $url, 4);


//Находим объект и тип действия
try {
    switch ($section) {     
        case 'files': 
            //Создаем и инициализируем экземпляр класса для работы с файлами 
            $sql = new Sql('uploader');            
            $album = new Album($_REQUEST, array(
                'tableName'    => 'uploader',
                'files'        => array(
                    array('field' => 'original', 'dir' => 'files_original/', 'fit' => true,      'width' => 1200, 'height' => 1200, 'ext' => 'jpg'),
                    array('field' => 'image',    'dir' => 'files_image/',    'fit' => 'contain', 'width' => 800,  'height' => 800,  'ext' => 'jpg'),
                    array('field' => 'thumb',    'dir' => 'files_thumb/',    'fit' => 'cover',   'width' => 160,  'height' => 160,  'ext' => 'png')
                ),
                'maxSize'          => '4M',
                'maxSpace'         => '100M',
                'maxNumberOfFiles' => 100,
                'allowedType'      => array('jpeg', 'jpg', 'png', 'gif',
                    'bmp', 'psd', 'psp', 'ai', 'eps', 'cdr',
                    'mp3', 'mp4', 'wav', 'aac', 'aiff', 'midi',
                    'avi', 'mov', 'mpg', 'flv', 'mpa',
                    'pdf', 'txt', 'rtf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'djvu', 'djv',
                    'bat', 'cmd', 'dll', 'inf', 'ini', 'ocx', 'sys',
                    'htm', 'html', 'write', 'none',
                    'zip', 'rar', 'dmg', 'sitx')
            ));
            switch ($method) {
                case 'GET':    $res = isset($id) ? $album->getOne($id) : $album->get();                  break;
                case 'PUT':    $res = $album->add();                                                     break;
                case 'POST':   $res = isset($id) ? $album->update($id, $r) : $sql->savesort($r['sort']); break;
                case 'DELETE': $res = $album->delete($id);                                               break;
            }
            break;
            
        default: throw new Exception('Не получен тип действия', 15);
    }
    if (isset($res)) echo json_encode($res);
   
} catch(Exception $e) {
    Header('HTTP/1.1 503 Service Unavailable');
    echo json_encode(array('error' => array('msg' => $e->getMessage(), 'code' => $e->getCode())));
}




/**
* Класс для работы с файлами
*/
class Album {
    // Параметры по умолчанию
    public $prm = array(
        'tableName' => 'files', //Имя таблицы в БД
        'files'     => array(array(//В первом поле настройки для оригинала
            'field'     => 'files',  //Поле в БД для хранения имени файла
            'dir'       => 'files/', //Папка, куда загружаются файлы
            'fit'       => 'cover',
            'width'     => 160,
            'height'    => 160,
            'ext'       => 'jpg',
            'quality'   => 75,
            'copyright' => false,
            'w_pct'     => 1,
            'h_pct'     => 1,
            'x_pct'     => null,
            'y_pct'     => null)
        ),
        'maxNumberOfFiles' =>  100000, //Максимальное количество загруженных файлов (0 — без ограничений)
        'maxSpace'         => '10G', //Максимально допустимый вес всех загруженных файлов (0 — без ограничений)
        'maxSize'          => '10M', //Максимально допустимый вес загружаемого файла (0 — ограничен только настройками сервера или формы)
        'allowedType'      => array('jpeg', 'jpg', 'png', 'gif'), //Допустимые расширения для загрузки
        'ns'               => 0 //обрезка имени файла
    );

  	public function __construct($request, $param) {
        
        foreach ($param as $k => $v) $this->prm[$k] = $v;
        
        $filds = array();
        foreach ($this->prm['files'] as $file) $filds[] = $file['field'];

        $this->prm['maxSpace'] = $this->toBytes($this->prm['maxSpace']);
        $this->prm['maxSize']  = $this->toBytes($this->prm['maxSize']);       
        $this->prm['sql'] = new Sql($this->prm['tableName'], array_merge($filds, array('size','note')));
	  }
    
    /**
    * Возврат настроек плагина
    */
    public function settings() {
    
        return array(
            'files'            => $this->prm['files'],
            'maxNumberOfFiles' => $this->prm['maxNumberOfFiles'],
            'maxSpace'         => $this->prm['maxSpace'],
            'maxSize'          => $this->prm['maxSize'],
            'allowedType'      => $this->prm['allowedType'],
            'quantity'         => $this->checkQuantity(),
            'space'            => $this->checkSpace(),
            'errorBadType'     => sprintf('Можно загружать: %s', strtoupper(implode (', ', $this->prm['allowedType']))),
            'errorBigSize'     => sprintf('Вес не более %s МБ', round($this->prm['maxSize']/1048576, 2)),
            'errorMaxQuantity' => sprintf('Загружено максимальное количество файлов: %s', $this->prm['maxNumberOfFiles']),
            'errorMaxSize'     => sprintf('Осталось %s МБ свободного места', round(($this->prm['maxSpace'] - $this->checkSpace())/1048576, 2))
        );
  	}
    
    /**
    * Создание пустой записи и возврат ее id, а так же ограничений и текстов ошибок
    */
    public function add() {
        
        //$newItem = array_merge($this->prm['sql']->add(), $this->settings()); //массив с айдишником новой записи и настройками
        //$newItem['quantity']--; //т.к. пустая запись уже создана

        $newItem = $this->prm['sql']->add(); //сохраняем объект с айдишником записи
        $newItem['settings'] = $this->settings();
        $newItem['settings']['quantity']--; //т.к. пустая запись уже создана
        
        return $newItem;
	  }
    
    /**
    * Удаление элемента с указанным id
    */    
    public function delete($id) {
        $row = $this->prm['sql']->getOne($id);

        foreach ($this->prm['files'] as $file) {
            //Удаляем только миниатюры, созданные из картинок, оставляя иконки для файлов (имя которых совпадает с расширением файла)
            if ($file['dir'] && pathinfo($row[$file['field']], PATHINFO_FILENAME) !== pathinfo($row[$this->prm['files'][0]['field']], PATHINFO_EXTENSION)) {
                @unlink($file['dir'] . $row[$file['field']]);
            }
        }
        $this->prm['sql']->del($id);            

        return $row;
	}

    /**
    * Обновление элемента с указанным id, в т.ч. сохранение файла и возврат его имени и имени миниатюры
    */ 	
    public function update($id, $param) {  
        if ((int) $headers['Content-Length'] > $this->prm['maxSize']) {
            throw new Exception('Превышен размер файла, установленный на сервере', 5);
        }
    
        if (!empty($_FILES)) {
            $this->checkFreeSpace();
        
            //Загружаем файл на сервер (Обращаемся к первому элементу $_FILES[key($_FILES)], т.к. подразумевается, что в запросе присылается не более одного файла)
            try {
                list($original_name, $ext, $file_size, $file_type) = $this->saveFile($_FILES[key($_FILES)], $this->prm['files'][0]['dir'], $this->prm['maxSize'], $this->prm['allowedType'], $this->prm['ns']); 
            
            } catch (Exception $e) {            
                $this->delete($id);
                throw $e;
            }         
            
            $result = $result_db = array();
            
            if (in_array($ext, array('jpeg', 'jpg', 'png', 'gif'))) {
                //Подключаем графическую библиотеку и обрабатываем изображение
                include_once('lib/gd.php'); //или lib/magickwand.php, если она есть на хостинге и работает лучше.
                
                $files_rev = array_reverse($this->prm['files']); //Инвертируем массив, чтобы исходник с индексом 0 изменить последним

                foreach ($files_rev as $file) {
                
                    $result_db[$file['field']] = Image::edit(array_merge($file, array(
                        'file_input' => $this->prm['files'][0]['dir'] . $original_name,
                        'file_output' => $file['dir'] . $original_name)));
                        
                    $result[$file['field']] = $file['dir'] . $result_db[$file['field']];
                        
                    if (!$result[$file['field']]) throw new Exception('Не удалось обработать изображение', 16);     
                }
            } else {
                //Если это не картинка присваиваем всем полям кроме поля с оригиналом ссылки вида расширение.png
                foreach ($this->prm['files'] as $i => $file) {
                
                    $i == 0 ? $result_db[$file['field']] = $original_name : $result_db[$file['field']] = $ext . '.png'; 
         
                    //Дописываем к именам файлов пути, для отправки клиенту
                    $result[$file['field']] = $file['dir'] . $result_db[$file['field']];                  
                }
            }
            
            //Сохраняем в БД
            $this->prm['sql']->upd($id, array_merge($result_db, array('size' => filesize($result[$this->prm['files'][0]['field']]))));

            return $result;    
        } 
        if (isset($param['note'])) {
            $this->prm['sql']->upd($id, array('note' => mysql_real_escape_string($param['note'])));
        }
	}

    /**
    * Получение списка элементов
    */ 	    
    public function get($id = null) {

        $res = mysql_query("select * from `" . $this->prm['tableName'] . "`" . ($id ? "where `id` = " . (int)$id : "") . " order by `pos`" );

        $list = array();
        while ($row = mysql_fetch_assoc($res)) {
            foreach ($this->prm['files'] as $file) {

                if ($row[$file['field']]) {            
                    $row[$file['field']] =  $file['dir'] . $row[$file['field']];               
                } else {
                    //Удаляем записи без файлов, образовавшиеся в результате прошлых неудачных загрузок
                    $this->delete($row['id']);
                    continue 2;
                }
            }
            $list[] = $row;
        }
        return $list;
	}
    
    /**
    * Получение элемента по id
    */ 	    
    public function getOne($id = null) {
    
        if (!is_null($id)) {
            $result = $this->get($id);
            return $result[0];
        }
	}

    /**
    * Функции проверки количества загруженных файлов и занятого места
    */ 
    public function checkFreeSpace() {
        //Проверяем, не превышено ли количество загружаемых файлов (актуально, если файлы после загрузки уменьшаются до определенного размера)
        if ($this->checkQuantity() >= $this->prm['maxNumberOfFiles']) {
            throw new Exception('Превышено количество загружаемых файлов', 13);
        }      
        //Проверяем, не превышено ли отведенное для хранения место (актуально, если файлы сохраняются без обработки)
        if ($this->prm['maxSpace'] && $this->checkSpace() >= $this->prm['maxSpace']) {
            throw new Exception('Превышено отведенное для хранения место', 14);
        }
    }
    
    public function checkQuantity() {
        $res = mysql_query("select count(*) as quantity from `" . $this->prm['tableName'] . "`");
        $row = mysql_fetch_assoc($res);
        
        return $row['quantity'];
    }
    
    public function checkSpace() {
        $space = mysql_query("select sum(`size`) from `" . $this->prm['tableName'] . "`");
        list($space) = mysql_fetch_row($space);
        
        return (int) $space;
    }
    
    /**
    * Загрузка файла на сервер
    */ 
	public function saveFile($file, $fileDir, $maxSize, $allowedType, $ns) {

        if ($file['error']) {			
            throw new Exception('Неудачная загрузка в $_FILES', $file['error']);
        }			
        if ($maxSize && $file['size'] > $maxSize){	
            throw new Exception('Превышен допустимый размер файла', 12);
        }

        //Если файл без расширения, узнаем его из MIME-типа
        if (!($ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)))) $ext = preg_replace('/^.*([^\/]*)$/U', '$1', $file['type']);
        if (!in_array($ext, $allowedType)){		
            throw new Exception('Файл неразрешенного типа', 10);
        }
        
        //Генерируем новое имя и сохраняем
        $new_file_name = substr(uniqid(), $ns) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $fileDir . $new_file_name)) {
            throw new Exception('Не удалось переместить из временной директории', 9);
        }
        
        return array($new_file_name, $ext, $file['size'], $file['type'], $file['name']);
	}
	
	public function toBytes($val) {
		$val = trim($val);
		$last = strtolower($val[strlen($val) - 1]);
		switch ($last) {
			case 'g': $val *= 1024;
			case 'm': $val *= 1024;
			case 'k': $val *= 1024;
		}
		return $val;
	}
}

class Sql {

    private $tableName;
    public $defFields = array('id','pos','pid');
    public $fields = array();

	public function __construct($tableName, $whiteList = array()) {
    
        $this->tableName = $tableName;
        $this->fields = $whiteList;
	}
    
    /**
    * Удаление полей, которых нет в списках fields и defFields
    */
    public function validate($data = array()) {
        
        return array_intersect_key($data, array_flip(array_merge($this->defFields, $this->fields)));
    }
    
    /**
    * Преобразование массива значений типа name_$ru:'ruVal', name_$en:'enVal' к виду name:[{lang:'ru', text:'ruVal'},{lang:'en', text:'enVal'}]
    * @param string $separator - строка, по которой происходит деление
    * @param string $filter    - имя части, значение которой присвоится родительскому массиву.
    *                            Напр.: при $filter = 'ru' исходный массив преобразуется к виду 'name' => ruVal
    */
    function arraySep2dim(array $in, $separator = '_$', $keyname = 'key', $valname = 'value', $filter = null) {
        $result = array();
        $filtered = array();
        foreach ($in as $key => $value) {
            $ptr = &$result;
            $parent = '';
            foreach (explode($separator, $key) as $k => $token) {
                if (in_array($token, $filtered)) continue 2;
                if (!$filter || $token != $filter || $k == 0) {
                    if ($k == 0) {
                        $ptr = &$ptr[$token];
                    } else {
                        $i = isset($ptr) ? count($ptr) : 0;
                        if ($ptr[$i-1][$keyname] == $token) $i--;
                        
                        $ptr[$i][$keyname] = $token;
                        $ptr = &$ptr[$i][$valname];
                    }
                    $parent = $token;
                } else {
                    $filtered[] = $parent;
                    break;
                }
            }
            $ptr = $value;
        }
        return $result;
    }
        
    /**
    * Создание записи c начальными значениями и возврат ее id
    */
    public function add($data = array()) {
    
        $data = $this->validate($data);
    
        $setsTmp = array();
        foreach ($data as $field => $value) {
            $setsTmp[] = "`" . $field . "` = '" . $value . "'";
        }
        $sets = empty($setsTmp) ? "`id` = NULL" : implode(",", $setsTmp);
        
        mysql_query("insert into `" . $this->tableName . "` set " . $sets);
        $new_id = mysql_insert_id();
   
        return array('id'=> $new_id);
	}
    
    /**
    * Удаление записи с указанным id
    */    
    public function del($id) {

        mysql_query("delete from `" . $this->tableName . "` where `id` = " . (int)$id);
        //mysql_query($query) or die(mysql_error())
        //return "delete from `" . $this->tableName . "` where `id` = " . (int)$id;
	}
    
    /**
    * Обновление элемента с указанным id. data может содержать подмассивы, напр.: 'title' => array('ru' => 'заголовок', 'en' => 'title'). Они буду преобразованы в имена с нижним подчеркиванием
    */ 	
    public function upd($id, $data = array()) {
    
        $data = $this->validate($data);
        //Вспомогательные переменные нельзя обновлять напрямую
        unset($data['id']);
        unset($data['pid']);
        unset($data['pos']);
    
        $setsTmp = array();
        foreach ($data as $field => $value) {
        
            if (is_array($value)) {
                //Приводим переменные подмассива к виду имяПодмассива_$имяПеременнойПодмассива
                foreach ($value as $v) {
                    $setsTmp[] = "`" . $field . "_$" . $v['lang'] . "` = '" . $v['text'] . "'";
                }
            } else {
            
                $setsTmp[] = "`" . $field . "` = '" . $value . "'";
            }
        }
        $sets = implode(",", $setsTmp);
        
        mysql_query("update `" . $this->tableName . "` set " . $sets . " where `id` = " . (int)$id);
	}

    /**
    * Получение элемента по id или списка элементов для одного языка
    */ 	    
    public function get($lang = null, $id = null) {

        $res = mysql_query("select * from `" . $this->tableName . "`" . ($id ? "where `id` = " . (int)$id : "") . " order by `pos`" );
        $list = array();
        for ($i = 0; $row = mysql_fetch_assoc($res); $i++) {       
            $list[$i] = $this->validate($this->arraySep2dim($row, '_$', 'lang', 'text', $lang));
        }

        return $list;
	}
    
    /**
    * Получение элемента по id
    */ 	    
    public function getOne($id = null, $lang = null) {

        if (!is_null($id)) {
            $result = $this->get($lang, $id);
            return $result[0];
        }
	}
    
    /**
    * Сохранение порядка расположения элементов
    */ 	
	public function savesort($posArr, $pidArr = null) {
    
        $possTmp = array();
        if (!empty($posArr) && !empty($pidArr)) {
        
            foreach ($posArr as $k => $v) {
                $possTmp[] = "(" . (int)$v . "," . (int)$k . "," . ($pidArr[$k] ? (int)$pidArr[$k] : 'null') . ")"; //Пустое значение обязательно должно быть null чтобы не было конфликта внешнего ключа
            }
            mysql_query("insert into `" . $this->tableName . "` (`id`, `pos`, `pid`) values " . implode(", ", $possTmp) . " on duplicate key update `pos` = values(`pos`), `pid` = values(`pid`)");
        
        } else if (!empty($posArr)) {
        
            foreach ($posArr as $k => $v) {
                $possTmp[] = "(" . (int)$v . "," . (int)$k . ")";
            }
            mysql_query("insert into `" . $this->tableName . "` (`id`, `pos`)        values " . implode(", ", $possTmp) . " on duplicate key update `pos` = values(`pos`)");
        }
        //return true;
	}   
}
?>
