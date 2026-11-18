// Составы команд. Хранятся в .js (а не .json), чтобы игра открывалась двойным кликом без сервера.
// Формат: SQUADS[тип][команда] = { goalkeepers, defenders, midfielders, forwards }
const SQUADS = {
  "russia": {
    "Спартак": {
      "goalkeepers": ["Селихов", "Ребров", "Акмурзин"],
      "defenders": ["Джикия", "Маслов", "Чернов", "Хлусевич", "Литвинов", "Тавареш", "Ещенко", "Рыбус"],
      "midfielders": ["Зобнин", "Литвинов", "Умяров", "Мозес", "Игнатов", "Денисов", "Хромов", "Маркитесов", "Пруцев"],
      "forwards": ["Соболев", "Промес", "Николсон", "Бальде", "Мелёхин", "Понсе"]
    },
    "Зенит": {
      "goalkeepers": ["Кержаков", "Одоевский", "Васютин"],
      "defenders": ["Караваев", "Ловрен", "Круговой", "Сантос", "Чистяков", "Родригао", "Алип", "Адамов"],
      "midfielders": ["Барриос", "Вендел", "Клаудиньо", "Малком", "Ерохин", "Кузяев", "Кравцов", "Мостовой", "Мантуан"],
      "forwards": ["Дзюба", "Сердар", "Иван", "Кассьерра", "Мостовой", "Чистяков"]
    },
    "ЦСКА": {
      "goalkeepers": ["Акинфеев", "Тороп"],
      "defenders": ["Фернандес", "Магнуссон", "Дивеев", "Щенников", "Карпов", "Набабкин", "Гайч", "Тикнизян"],
      "midfielders": ["Обляков", "Кучаев", "Мухин", "Медина", "Здьелар", "Глебов"],
      "forwards": ["Чалов", "Захарян", "Тикнизян", "Эджуке", "Бохинен"]
    },
    "Локомотив": {
      "goalkeepers": ["Гилерме", "Худяков", "Коченков"],
      "defenders": ["Живоглядов", "Едвай", "Пабло", "Рыбус", "Ненахов", "Тикнизян", "Сильянов", "Фассон"],
      "midfielders": ["Баринов", "Куликов", "Жемалетдинов", "Миранчук", "Керк", "Фассон", "Щетинин", "Раконьяц"],
      "forwards": ["Изидор", "Камано", "Смолов", "Тикнизян", "Фассон", "Раконьяц", "Игнатьев"]
    },
    "Динамо": {
      "goalkeepers": ["Шунин", "Лещук", "Будаков"],
      "defenders": ["Варела", "Сазонов", "Фомин", "Лаксальт", "Паршивлюк", "Сазонов", "Гутиеррес", "Евгеньев"],
      "midfielders": ["Фомин", "Шиманьски", "Захарян", "Грулев", "Карапузов", "Марадишвили", "Тюкавин", "Нгамале"],
      "forwards": ["Тюкавин", "Смолов", "Грулев", "Фомин", "Карапузов", "Нгамале", "Фернандес"]
    },
    "Краснодар": {
      "goalkeepers": ["Сафонов", "Агкацев", "Студнев"],
      "defenders": ["Рамирес", "Сорокин", "Черников", "Стоцкий", "Кайо", "Рамирес", "Волков", "Рамирес"],
      "midfielders": ["Вильена", "Классон", "Газинский", "Сулейманов", "Олусегун", "Апеков", "Баньяк", "Кривцов"],
      "forwards": ["Кордоба", "Олусегун", "Сулейманов", "Классон", "Апеков", "Москвичев", "Онугха"]
    },
    "Ростов": {
      "goalkeepers": ["Песьяков", "Бабурин", "Рудаков"],
      "defenders": ["Козлов", "Осипенко", "Поярков", "Хаджикадунич", "Лангович", "Альмквист", "Чернов", "Аланов"],
      "midfielders": ["Глебов", "Хашимото", "Норманн", "Байрамян", "Альмквист", "Тугарев", "Комличенко", "Щетинин"],
      "forwards": ["Комличенко", "Полоз", "Соу", "Байрамян", "Тугарев", "Голенков", "Альмквист"]
    },
    "Рубин": {
      "goalkeepers": ["Дюпин", "Кошелев", "Иван"],
      "defenders": ["Зотов", "Уремович", "Бегич", "Костюков", "Сантос", "Вулич", "Тальби", "Саплинов"],
      "midfielders": ["Кварацхелия", "Хвича", "Йевтич", "Шатов", "Абильдгор", "Тальби", "Саплинов", "Иван"],
      "forwards": ["Деспотович", "Кварацхелия", "Игнатьев", "Саплинов", "Костюков", "Тальби", "Йевтич"]
    },
    "Сочи": {
      "goalkeepers": ["Джанаев", "Заика", "Адамов"],
      "defenders": ["Терехов", "Мевля", "Маргасов", "Заика", "Прошин", "Барач", "Дркушич", "Миладинович"],
      "midfielders": ["Нобоа", "Цаллагов", "Попов", "Бурмистров", "Ушатов", "Адамс", "Касьера", "Заика"],
      "forwards": ["Касьера", "Дзюба", "Барсов", "Колесниченко", "Адамс", "Мелкадзе", "Попов"]
    },
    "Ахмат": {
      "goalkeepers": ["Шелия", "Гудиев", "Солдатенко"],
      "defenders": ["Быстров", "Пуцко", "Семенов", "Богосавац", "Ненадович", "Уциев", "Лысцов", "Быстров"],
      "midfielders": ["Швец", "Бериша", "Ильин", "Тимофеев", "Садулаев", "Коновалов", "Ахмедов", "Уциев"],
      "forwards": ["Конате", "Понсе", "Ильин", "Бериша", "Садулаев", "Мелкадзе", "Тимофеев"]
    },
    "Крылья": {
      "goalkeepers": ["Фролов", "Ломаев", "Корнюшин"],
      "defenders": ["Божин", "Карпов", "Чернов", "Горшков", "Ежов", "Костанца", "Солдатенков", "Божин"],
      "midfielders": ["Зиньковский", "Ежов", "Иванисеня", "Кабутов", "Коваленко", "Горшков", "Пиняев", "Ежов"],
      "forwards": ["Сергеев", "Пиняев", "Зиньковский", "Кабутов", "Коваленко", "Костанца", "Иванисеня"]
    },
    "Оренбург": {
      "goalkeepers": ["Климович", "Гошев", "Астапов"],
      "defenders": ["Малых", "Аюпов", "Шагов", "Сиваков", "Гойкович", "Андреев", "Вера", "Малых"],
      "midfielders": ["Майрович", "Козлов", "Андреев", "Вера", "Фамейе", "Марин", "Эктова", "Козлов"],
      "forwards": ["Фамейе", "Галаджан", "Марин", "Эктова", "Козлов", "Андреев", "Вера"]
    },
    "ПариНН": {
      "goalkeepers": ["Нигматуллин", "Кахоров", "Агкацев"],
      "defenders": ["Алексеев", "Масоэро", "Гоцев", "Каккоев", "Стоцкий", "Алиев", "Тамбиев", "Алексеев"],
      "midfielders": ["Махатадзе", "Сулейманов", "Калинский", "Сапета", "Берковский", "Кравцов", "Яковлев", "Сулейманов"],
      "forwards": ["Сулейманов", "Калинский", "Сапета", "Берковский", "Яковлев", "Кравцов", "Махатадзе"]
    },
    "Факел": {
      "goalkeepers": ["Свистунов", "Адамов", "Гудиев"],
      "defenders": ["Божин", "Суслов", "Мастюков", "Дашаев", "Моцпан", "Алишин", "Никитин", "Божин"],
      "midfielders": ["Акбашев", "Дудиев", "Никитин", "Квеквескири", "Макеев", "Шуманский", "Гонгадзе", "Дудиев"],
      "forwards": ["Гонгадзе", "Макеев", "Шуманский", "Квеквескири", "Акбашев", "Божин", "Дашаев"]
    },
    "Акрон": {
      "goalkeepers": ["Волков", "Смирнов", "Котов"],
      "defenders": ["Петров", "Соколов", "Кузнецов", "Михайлов", "Новиков", "Федоров", "Волков", "Петров"],
      "midfielders": ["Васильев", "Павлов", "Семенов", "Голубев", "Козлов", "Морозов", "Виноградов", "Соколов"],
      "forwards": ["Лебедев", "Козлов", "Семенов", "Морозов", "Павлов", "Васильев", "Кузнецов"]
    },
    "Балтика": {
      "goalkeepers": ["Бориско", "Латышонок", "Иванов"],
      "defenders": ["Осипенко", "Адамов", "Плиев", "Макарчук", "Тикажев", "Кашчелан", "Бориско", "Осипенко"],
      "midfielders": ["Долгов", "Кашчелан", "Альшин", "Колесниченко", "Мещанинов", "Долгов", "Кашчелан", "Альшин"],
      "forwards": ["Марков", "Долгов", "Кашчелан", "Альшин", "Мещанинов", "Колесниченко", "Марков"]
    }
  },
  "world": {
    "Arsenal": {
      "goalkeepers": ["Кепа Аррисабалага", "Давид Райя"],
      "defenders": ["Вильям Салиба", "Габриэл", "Юрриен Тимбер", "Бен Уайт", "Риккардо Калафьори", "Пьеро Инкапье"],
      "midfielders": ["Мартин Эдегор", "Эберечи Эзе", "Микель Мерино", "Деклан Райс", "Леандро Троссард"],
      "forwards": ["Габриэл Жезус", "Нони Мадуэке", "Габриэл Мартинелли", "Букайо Сака"]
    },
    "Bayern": {
      "goalkeepers": ["Мануэль Нойер", "Свен Ульрайх", "Йонас Урбиг"],
      "defenders": ["Дайо Упамекано", "Мин Джэ Ким", "Джонатан Та", "Альфонсо Дэвис", "Рафаэл Геррейро"],
      "midfielders": ["Йозуа Киммих", "Леон Горецка", "Джамал Мусиала", "Майкл Олисе", "Конрад Лаймер"],
      "forwards": ["Серж Гнабри", "Гарри Кейн", "Николас Джексон", "Луис Диас"]
    },
    "Liverpool": {
      "goalkeepers": ["Алиссон", "Георгий Мамардашвили", "Фредди Вудмен"],
      "defenders": ["Джо Гомес", "Вирджил ван Дейк", "Ибраима Конате", "Милош Керкез", "Конор Брэдли", "Эндрю Робертсон", "Джереми Фримпонг"],
      "midfielders": ["Флориан Вирц", "Доминик Собослаи", "Алексис Макаллистер", "Кертис Джонс", "Райан Гравенберх"],
      "forwards": ["Александер Исак", "Мохамед Салах", "Федерико Кьеза", "Коди Гакпо", "Юго Экитике"]
    },
    "Barca": {
      "goalkeepers": ["Марк-Андре тер Штеген", "Войцех Щенсны"],
      "defenders": ["Рональд Араухо", "Алекс Бальде", "Эрик Гарсия", "Жоау Канселу", "Андреас Кристенсен", "Пау Кубарси", "Жюль Кунде"],
      "midfielders": ["Гави", "Педри", "Френки де Йонг", "Марк Берналь", "Фермин Лопес", "Дани Ольмо"],
      "forwards": ["Роберт Левандовски", "Ламин Ямаль", "Рафинья", "Маркус Рэшфорд"]
    },
    "Real": {
      "goalkeepers": ["Тибо Куртуа", "Андрей Лунин", "Фран Гонсалес"],
      "defenders": ["Дани Карвахаль", "Эдер Милитао", "Дэвид Алаба", "Трент Александер-Арнолд", "Рауль Асенсио", "Альваро Каррерас", "Фран Гарсия", "Антонио Рюдигер", "Ферлан Менди"],
      "midfielders": ["Джуд Беллингем", "Эдуардо Камавинга", "Федерико Вальверде", "Орельен Чуамени", "Арда Гюлер", "Дани Себальос"],
      "forwards": ["Винисиус Жуниор", "Килиан Мбаппе", "Родриго", "Гонсало Гарсия", "Браим Диас", "Франко Мастантуоно"]
    },
    "Tottenham": {
      "goalkeepers": ["Vicario", "Forster", "Austin"],
      "defenders": ["Porro", "Romero", "Van de Ven", "Udogie", "Emerson", "Davies", "Dragusin"],
      "midfielders": ["Bissouma", "Sarr", "Maddison", "Kulusevski", "Bentancur", "Skipp", "White"],
      "forwards": ["Son", "Richarlison", "Johnson", "Werner", "Solomon", "Gil"]
    },
    "PSG": {
      "goalkeepers": ["Donnarumma", "Navas", "Letellier"],
      "defenders": ["Hakimi", "Marquinhos", "Skriniar", "Mendes", "Ramos", "Bernat", "Mukiele"],
      "midfielders": ["Verratti", "Vitinha", "Ruiz", "Soler", "Zaire-Emery", "Danilo", "Lee"],
      "forwards": [ "Dembele", "Ramos", "Kolo Muani", "Barcola", "Asensio"]
    },
    "Chelsea": {
      "goalkeepers": ["Sanchez", "Petrovic", "Bettinelli"],
      "defenders": ["James", "Silva", "Fofana", "Chilwell", "Gusto", "Badiashile", "Colwill"],
      "midfielders": ["Caicedo", "Enzo", "Gallagher", "Fernandez", "Chukwuemeka", "Cesare", "Carney"],
      "forwards": ["Sterling", "Jackson", "Palmer", "Madueke", "Nkunku"]
    },
    "Ajax": {
  "goalkeepers": ["Pasveer", "Ramen", "Gorter"],
  "defenders": ["Wijndal", "Bassey", "Sutalo", "Rensch", "Gaaei", "Gorduz", "Fitse", "Tahirovic"],
  "midfielders": ["Taylor", "Klaassen", "Hlynsson", "Berghuis", "Ritzmaier", "Godts", "Fitz-Jim", "Misidjan"],
  "forwards": ["Bergwijn", "Brobbey", "Akpom", "Carlos", "Mika", "Chuba"]
},
    "ManCity": {
      "goalkeepers": ["Ederson", "Ortega", "Carson"],
      "defenders": ["Walker", "Dias", "Stones", "Ake", "Cancelo", "Gvardiol", "Lewis"],
      "midfielders": ["De Bruyne", "Rodri", "Silva", "Gundogan", "Kovacic", "Nunes", "Phillips"],
      "forwards": ["Haaland", "Foden", "Grealish", "Alvarez", "Doku", "Bob"]
    },
    "Inter": {
      "goalkeepers": ["Sommer", "Audero", "Cordaz"],
      "defenders": ["Darmian", "Acerbi", "Bastoni", "Pavard", "Dimarco", "De Vrij", "Dumfries"],
      "midfielders": ["Barella", "Calhanoglu", "Mkhitaryan", "Frattesi", "Asllani", "Sensi", "Carboni"],
      "forwards": ["Lautaro", "Thuram", "Arnautovic", "Sanchez", "Klaassen", "Esposito"]
    },
    "Atletico": {
      "goalkeepers": ["Oblak", "Grsic", "Moya"],
      "defenders": ["Molina", "Savic", "Gimenez", "Hermoso", "Witsel", "Lino", "Azpilicueta"],
      "midfielders": ["Koke", "De Paul", "Saul", "Llorente", "Barrios", "Riquelme", "Guevara"],
      "forwards": ["Griezmann", "Morata", "Correa", "Lino", "Depay", "Sorloth"]
    },
    "Roma": {
      "goalkeepers": ["Patricio", "Svilar", "Boer"],
      "defenders": ["Mancini", "Smalling", "Ndicka", "Spinazzola", "Karsdorp", "Llorente", "Celik"],
      "midfielders": ["Cristante", "Paredes", "Pellegrini", "Matic", "Aouar", "Bove", "Pisilli"],
      "forwards": ["Dybala", "Lukaku", "El Shaarawy", "Abraham", "Belotti", "Shomurodov"]
    },
    "Dortmund": {
      "goalkeepers": ["Kobel", "Meyer", "Lotka"],
      "defenders": ["Ryerson", "Hummels", "Schlotterbeck", "Bensebaini", "Sule", "Wolf", "Coulibaly", "Beyer"],
      "midfielders": ["Can", "Ozcan", "Brandt", "Reus", "Sabitzer", "Nmecha", "Malen", "Adeyemi"],
      "forwards": ["Haller", "Moukoko", "Reyna", "Beier", "Gittens", "Durán"]
    },
    "Benfica": {
      "goalkeepers": ["Vlachodimos", "Trubin", "Miles"],
      "defenders": ["Bah", "Otamendi", "Silva", "Grimaldo", "Morato", "Aursnes", "Carreras"],
      "midfielders": ["Kokcu", "Neves", "Florentino", "Chiquinho", "Joao Mario", "Samo", "Neres"],
      "forwards": ["Ramos", "Di Maria", "Tengstedt", "Cabral", "Arthur", "Paulinho"]
    },
    "Napoli": {
      "goalkeepers": ["Meret", "Contini", "Gollini"],
      "defenders": ["Di Lorenzo", "Kim", "Rrahmani", "Mario Rui", "Juan Jesus", "Olivera"],
      "midfielders": ["Anguissa", "Lobotka", "Zielinski", "Elmas", "Cajuste", "Ndombele"],
      "forwards": ["Osimhen", "Kvaratskhelia", "Politano", "Simeone", "Raspadori", "Lindstrom"]
    },
    "Atalanta": {
      "goalkeepers": ["Carnesecchi", "Musso", "Rossi"],
      "defenders": ["Scalvini", "Djimsiti", "Kolasinac", "Hateboer", "Ruggeri", "Toloi", "Godfrey"],
      "midfielders": ["De Roon", "Koopmeiners", "Ederson", "Pasalic", "Lookman", "Zappacosta", "Muriel"],
      "forwards": ["Scamacca", "Zapata", "Lookman", "Pasalic", "Muriel", "Zappacosta"]
    },
    "Frankfurt": {
      "goalkeepers": ["Trapp", "Grahl", "Diant"],
      "defenders": ["Koch", "Tuta", "Nkounkou", "Buta", "Theate", "Pacheco", "Collins"],
      "midfielders": ["Skhiri", "Larsson", "Chaibi", "Gotze", "Dina Ebimbe", "Rode", "Kristensen"],
      "forwards": ["Marmoush", "Ekitike", "Bahoya", "Knauff", "Perrino", "Uzun"]
    },
    "Sporting": {
      "goalkeepers": ["Adan", "Israel", "Franco"],
      "defenders": ["Porro", "Inacio", "Diomande", "Esgaio", "Matheus Reis", "Hjulmand", "Catamo"],
      "midfielders": ["Hjulmand", "Morita", "Goncalves", "Trincao", "Edwards", "Geny", "Paulinho"],
      "forwards": ["Gyokeres", "Paulinho", "Trincao", "Edwards", "Geny", "Catamo"]
    },
    "Porto": {
      "goalkeepers": ["Diogo Costa", "Claudio", "Samuel"],
      "defenders": ["Joao Mario", "Pepe", "Otavio", "Zaidu", "Wendell", "Cardona", "Fabio Cardoso"],
      "midfielders": ["Uribe", "Nico Gonzalez", "Alan Varela", "Pepê", "Galeno", "André Franco", "Varela"],
      "forwards": ["Taremi", "Evanilson", "Pepê", "Galeno", "Toni Martinez", "Conceicao"]
    },
    "ManUtd": {
      "goalkeepers": ["Onana", "Bayindir", "Heaton"],
      "defenders": ["Dalot", "Varane", "Martinez", "Shaw", "Malacia", "Lindelof", "Maguire"],
      "midfielders": ["Casemiro", "Mainoo", "Mount", "Fernandes", "Eriksen", "Amrabat", "Garnacho"],
      "forwards": ["Rashford", "Hojlund", "Antony", "Garnacho", "Diallo", "Pellistri"]
    },
    "Brugge": {
      "goalkeepers": ["Mignolet", "Nuytinck", "Deli"],
      "defenders": ["Mechele", "Bjorn", "Sylla", "Cuylen", "Spierings", "Vanaken", "Nilsson"],
      "midfielders": ["Vanaken", "Skov Olsen", "Vermant", "Sowah", "Onyedika", "Romeo", "Ferran"],
      "forwards": ["Jutgla", "Skov Olsen", "Vermant", "Sowah", "Onyedika", "Ferran"]
    },
    "Fiorentina": {
      "goalkeepers": ["Terracciano", "Pietro", "Fruchtl"],
      "defenders": ["Dodò", "Milenkovic", "Martinez", "Biraghi", "Kayode", "Ranieri", "Comuzzo"],
      "midfielders": ["Arthur", "Amrabat", "Ricci", "Gonzalez", "Ikone", "Beltran", "Folorunsho"],
      "forwards": ["Gonzalez", "Belotti", "Kouame", "Ikone", "Beltran", "Folorunsho"]
    },
    "Milan": {
      "goalkeepers": ["Maignan", "Sportiello", "Torriani"],
      "defenders": ["Theo Hernandez", "Tomori", "Thiaw", "Calabria", "Emerson Royal", "Pavlovic", "Gabbia", "Walker"],
      "midfielders": ["Reijnders", "Musah", "Loftus-Cheek", "Fofana", "Bennacer", "Adli", "Pulicic", "Chukwueze"],
      "forwards": ["Leao", "Morata", "Pulicic", "Okafor", "Chukwueze", "Jovic"]
    },
    "Betis": {
      "goalkeepers": ["Rui Silva", "Claudio", "Pau Lopez"],
      "defenders": ["Sabaly", "Pezzella", "Bartra", "Miranda", "Abner", "Sokratis", "Bellerin"],
      "midfielders": ["Guido", "Fekir", "Rodriguez", "Isco", "Fornals", "Ayoze", "Assal"],
      "forwards": ["Isco", "Fornals", "Ayoze", "Assal", "Abde", "Rodriguez"]
    },
    "AstonVilla": {
      "goalkeepers": ["Martinez", "Olsen", "Stead"],
      "defenders": ["Cash", "Konsa", "Torres", "Digne", "Mings", "Pau", "Kamara"],
      "midfielders": ["McGinn", "Douglas Luiz", "Kamara", "Bailey", "Rogers", "Buendia", "Onana"],
      "forwards": ["Watkins", "Bailey", "Rogers", "Buendia", "Onana", "Durán"]
    },
    "Juventus": {
      "goalkeepers": ["Szczesny", "Perin", "Pinsoglio"],
      "defenders": ["Danilo", "Bremer", "Gatti", "Alex Sandro", "Cambiaso", "Rugani", "Weah"],
      "midfielders": ["Locatelli", "Rabiot", "McKennie", "Kostic", "Fagioli", "Miretti", "Ilhan"],
      "forwards": ["Vlahovic", "Chiesa", "Milik", "Kean", "Yildiz", "Nico"]
    },
    "Sevilla": {
      "goalkeepers": ["Bono", "Dmitrovic", "Nyland"],
      "defenders": ["Navas", "Ramos", "Badé", "Acuna", "Pedrosa", "Gudelj", "Montiel"],
      "midfielders": ["Rakitic", "Soumare", "Ocampos", "Suso", "Torre", "Gomez", "Salas"],
      "forwards": ["En-Nesyri", "Lamela", "Mir", "Lukebakio", "Sow", "Sanchez"]
    },
    "Valencia": {
      "goalkeepers": ["Mamardashvili", "Dominguez", "Jaume"],
      "defenders": ["Correia", "Paulista", "Vazquez", "Gaya", "Foulquier", "Mosquera", "Jach"],
      "midfielders": ["Guillamon", "Almeida", "Fajardo", "Lopez", "Duro", "Gonzalez", "Peter"],
      "forwards": ["Hugo Duro", "Castillejo", "Selva", "Canos", "Moriba", "Lopez"]
    },
    "Nice": {
      "goalkeepers": ["Bulka", "Dupé", "Lecomte"],
      "defenders": ["Lotomba", "Dante", "Todibo", "Bardsley", "Ndayishimiye", "Abdi", "Mendy"],
      "midfielders": ["Thuram", "Rosario", "Boudaoui", "Moffi", "Laborde", "Guessand", "Bogdan"],
      "forwards": ["Moffi", "Laborde", "Guessand", "Bogdan", "Bamba", "Diop"]
    },
    "Osasuna": {
      "goalkeepers": ["Herrera", "Aitor", "Sergio"],
      "defenders": ["Vidal", "Catena", "Boyomo", "Cruz", "Areso", "Herrando", "Moncayola"],
      "midfielders": ["Torro", "Ibanez", "Moncayola", "Barja", "Oroz", "Ruben", "Aimar"],
      "forwards": ["Budimir", "Barja", "Oroz", "Ruben", "Aimar", "Garcia"]
    },
    "Girona": {
      "goalkeepers": ["Gazzaniga", "Juanpe", "Feliu"],
      "defenders": ["Yan Couto", "Dovbyk", "Blind", "Gutierrez", "Lopez", "Savio", "Tsygankov"],
      "midfielders": ["Herrera", "Aleix", "Portu", "Savio", "Tsygankov", "Castellanos", "Stuani"],
      "forwards": ["Dovbyk", "Portu", "Savio", "Tsygankov", "Castellanos", "Stuani"]
    },
    "Lazio": {
      "goalkeepers": ["Provedel", "Mandas", "Sepe"],
      "defenders": ["Lazzari", "Patric", "Romagnoli", "Marusic", "Hysaj", "Gendrey", "Tavares"],
      "midfielders": ["Cataldi", "Guendouzi", "Luis Alberto", "Zaccagni", "Felipe Anderson", "Isaksen"],
      "forwards": ["Immobile", "Zaccagni", "Felipe Anderson", "Isaksen", "Castellanos", "Pedro"]
    },
    "Feyenoord": {
      "goalkeepers": ["Bijlow", "Ramaj", "Ten Hagen"],
      "defenders": ["Trauner", "Hancko", "Beelen", "Hartman", "Pedersen", "Gimenez", "Bart Nieuwkoop"],
      "midfielders": ["Wieffer", "Stengs", "Calvert-Lewin", "Timber", "Hwang", "Szymanski", "Ueda"],
      "forwards": ["Gimenez", "Stengs", "Calvert-Lewin", "Timber", "Hwang", "Ueda"]
    }
  }
};
