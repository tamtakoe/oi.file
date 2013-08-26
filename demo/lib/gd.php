<?php
/**
* Класс для обработки изображений на сервере
* Использует GD Graphics Library
*/
abstract class Image {

    /**
	* Пропорциональное масштабирование и обрезка
	*
	* Работает с JPEG, PNG, и GIF.
	* Масштабирование производится так, чтобы изображение влезло в заданный прямоугольник. Пропорции сторон не изменяются.
    *
	* @params array  - параметры
	* @return string - Имя конечного файла или false в случае ошибки
	*/
	public function edit($params) {
    
        // Настройки по-умолчанию
        $prm = array(
            'fit'         => 'cover', //'cover' - обрезается чтобы заполнить всю область, 'contain' - целиком вмещается в заданный прямоугольник, true - то же, но меньшие изображения не масштабируются, false - сохраняется исходный масштаб                                                 
            'width'       => 1000,    // Ширина прямоугольника в px, если 0, не учитывается
            'height'      => 1000,    // Высота прямоугольника в px, если 0, не учитывается
            'ext'         => 'jpg',   // Тип конечного файла jpeg, png или gif. При null тип определяется из имени конечного файла. В противном случае из типа исходного
            'quality'     => 75,      // Качество конечного файла. 1–100 для JPEG (рекомендуется 75), 0—9 для PNG (рекомендуется 9, если сервер выдержит дополнительную нагрузку)
            'copyright'   => false,   // Будет ли наложен копирайт. Изображение берется из файла copyright.png
            'w_pct'       => 1,       // Ширина области обрезки в %*0.01
            'h_pct'       => 1,       // Высота области обрезки в %*0.01
            'x_pct'       => null,    // X-координата левого верхнего угла области обрезки в %*0,01. При null область обрезки расположится по-центру
            'y_pct'       => null,    // Y-координата левого верхнего угла области обрезки в %*0,01. При null область обрезки расположится по-центру
            'file_input'  => null,    // Расположение исходного файла
            'file_output' => null     // Расположение конечного файла, если установлено false, то исходный файл перезаписывается новым
        );
        $prm = array_merge($prm, $params);
        
		list($w, $h, $type) = getimagesize($prm['file_input']);
		if (!$w || !$h) return false; //Невозможно получить длину и ширину изображения
        
        if ($prm['fit'] !== 'cover') {
            //Вычисляем новые размеры изображения, если оно не вписывается
            $h1 = $h;
            if ($prm['width'] && is_numeric($prm['width']) && ($w > $prm['width'] || $prm['fit'] === 'contain')) {
                $new_w = $prm['width'];
                $new_h = $h1 = $new_w/($w/$h);
            }	
            if ($prm['height'] && is_numeric($prm['height']) && $h1 > $prm['height']) {
                $new_h = $prm['height'];
                $new_w = $new_h/($h/$w);
            }       
              
            //Если размеры не изменились (или не должны меняться) и не надо ставить копирайт, просто копируем файл
            if ((!$new_w ||!$prm['fit']) && !$prm['copyright']) return self::convert($prm['file_input'], $prm['file_output'], null, $prm['ext'], $prm['quality']);

            if (!$new_w || !$prm['fit']) {             
                //Если размеры не изменились, оставляем их старыми
                $new_w = $w;
                $new_h = $h;                 
            } 
        } else {
            $new_w = intval($prm['width']);
            $new_h = intval($prm['height']); 
        }
            
        //Читаем данные из исходного изображения
        switch ($type) {
            case IMAGETYPE_JPEG: $image = imagecreatefromjpeg($prm['file_input']); break;
            case IMAGETYPE_PNG:  $image = imagecreatefrompng($prm['file_input']); break;
            case IMAGETYPE_GIF:  $image = imagecreatefromgif($prm['file_input']); break;
            default: echo 'Некорректный формат файла'; return false; //Некорректный формат файла
        }
        
        //Создаем новое изображение	и задаем его размеры
        $new_image = imagecreatetruecolor($new_w, $new_h);
        
        if ($prm['fit'] === 'cover') {           
            //Проверяем корректность координат области обрезки
            if ($prm['w_pct'] <= 0 || $prm['w_pct'] > 1) $prm['w_pct'] = 1;
            if ($prm['h_pct'] <= 0 || $prm['h_pct'] > 1) $prm['h_pct'] = 1;
            if (!is_numeric($prm['x_pct']) || $prm['x_pct'] < 0 || $prm['x_pct'] >= 1) $prm['x_pct'] = (1 - $prm['w_pct']) / 2;
            if (!is_numeric($prm['y_pct']) || $prm['y_pct'] < 0 || $prm['y_pct'] >= 1) $prm['y_pct'] = (1 - $prm['h_pct']) / 2;
            
            //Переводим проценты в пиксели
            $src_w = $w*$prm['w_pct'];
            $src_h = $h*$prm['h_pct'];
            $src_x = min($w*$prm['x_pct'], $w-$src_w);
            $src_y = min($h*$prm['y_pct'], $h-$src_h);

            //Находимновы размеры сторон
            $src_w_new = $src_h*$new_w/$new_h;
            $src_h_new = $src_w*$new_h/$new_w;
            
            //Уменьшаем область до нужных размеров
            if ($src_w > $src_w_new) {
                $src_x += ($src_w - $src_w_new) / 2;
                $src_w = $src_w_new;
            } else {
                $src_y += ($src_h - $src_h_new) / 2;
                $src_h = $src_h_new;
            }

            //Создаем миниатюру
            imagecopyresampled($new_image, $image, 0, 0, $src_x, $src_y, $new_w, $new_h, $src_w, $src_h);
        } else {
            imagecopyresampled($new_image, $image, 0, 0, 0, 0, $new_w, $new_h, $w, $h); 
        }
        imagedestroy($image);
         
		//Ставим копирайт
		if ($prm['copyright']) {
			$file_copyright = 'copyright.png';
			list($cw, $ch) = getimagesize($file_copyright);
			
			$copyright_image = imagecreatefrompng($file_copyright);
			imagecopy($new_image, $copyright_image ,$new_w-$cw, $new_h-$ch, 0, 0, $cw, $ch);
			imagedestroy($copyright_image);
		}

		//Сохраняем
		return self::convert($prm['file_input'], $prm['file_output'], $new_image, $prm['ext'], $prm['quality']);
	}
	
	/**
	* Сохранение изображения в JPEG, PNG или GIF.
	*
	* Примеры:
	* convert('img/flower.png', 'thumb/astra.png')                   //Скопирует img/flower.png под именем thumb/astra.png
	* convert('img/flower.png', 'thumb/astra.jpeg')                  //Скопирует с преобразованием в jpeg с качеством по умолчанию
	* convert('img/flower.png', 'thumb/',          null,   jpeg)     //Скопирует с преобразованием в jpeg под именем thumb/flower.jpeg
	* convert('img/flower.png',  null,             null,   jpeg, 70) //Преобразует в jpeg с качеством 70
	* convert('img/flower.png',  null,             $image, jpeg)     //Сохранит $image под именем img/flower.jpeg, удалив перед этим img/flower.png 
	* convert( null,            'thumb/astra.png', $image)           //Сохранит $image под именем 'thumb/astra.png'
	*
	* @param string Имя исходного изображения
	* @param string Имя конечного изображения, если установлено false, то исходный файл перезаписывается новым
	* @param object Источник конечного изображения
	* @param string Тип конечного файла jpeg, png или gif. При null тип определяется из имени конечного файла. В противном случае из типа исходного
	* @param integer Качество конечного файла. 1–100 для JPEG (рекомендуется 75), 0—9 для PNG (рекомендуется 9, если сервер выдержит дополнительную нагрузку)
	* @return string Имя конечного файла или false в случае ошибки
	*/
	public function convert($file_input, $file_output = false, $image, $ext = null, $quality = null) {

		//Определяем тип конечного файла.
		//Если тип файла не указан, он будет взят из имени конечного файла, если же его нет, то из типа исходного
		list($w, $h, $type) = getimagesize($file_input);
		$file_input_ext = image_type_to_extension($type, false);
		$file_output_ext = pathinfo($file_output, PATHINFO_EXTENSION);
		
		if (!$ext && !$file_output_ext) {
			$ext = $file_input_ext;
		} elseif (!$ext) {
			$ext = $file_output_ext;
		}
		
		$ext = strtolower($ext);
		
		//Если источник изображения пуст, но требуется преобразование в другой формат, загружаем в источник исходный файл 
		if (!$image && $file_input_ext != $ext) {
			switch ($type) {
				case IMAGETYPE_JPEG: $image = imagecreatefromjpeg($file_input); break;
				case IMAGETYPE_PNG:  $image = imagecreatefrompng($file_input); break;
				case IMAGETYPE_GIF:  $image = imagecreatefromgif($file_input); break;
				default: return false; //Файл некорректного типа
			}
		}
	
		//Если перемещение не требуется и в источнике есть изображение, удаляем старый файл
		if (!$file_output || $file_output == $file_input) {
			if ($image) unlink($file_input);
			$file_output = $file_input;
			$fixed = true;
		}
		
		//Определяем имя и путь для нового файла
		$path = pathinfo($file_output, PATHINFO_DIRNAME).'/';
		$name = pathinfo($file_output, PATHINFO_FILENAME).'.';

		//Если преобразование не требуется, просто копируем файл
		if (!$image) {
			if (!$fixed) {
				if (!copy($file_input, $path.$name.$ext)) return false; //Не удалось скопировать
			}
			return $name.$ext;
		}
		
		//Преобразуем и сохраняем
		switch ($ext) {
			case 'jpeg':
			case 'jpg':
				$ext = 'jpeg';
				if (!is_numeric($quality) || $quality < 1 || $quality > 100) $quality = 75;
				if (!imagejpeg($image, $path.$name.$ext, $quality)) return false; //Не удалось сохранить в jpeg
				break;
				
			case 'gif':
				if (!imagegif($image, $path.$name.$ext)) return false; //Не удалось сохранить в gif
				break;
				
			default:
				$ext = 'png';
				if (!is_numeric($quality) || $quality < 1 || $quality > 100) $quality = 9;
				$quality = round($quality / 11.111111);
				if (!imagepng($image, $path.$name.$ext, $quality)) return false; //Не удалось сохранить в png
		}
		imagedestroy($image);
		
		return $name.$ext;
	}
}
?>