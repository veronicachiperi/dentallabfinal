/* © 2026 Veronica Chiperi — PRIVATE CAD. Cod proprietar / Proprietary code. */
// ============================================================
// i18n — traducere RO ⇄ RU pentru tot panoul intern.
// Traduceri scrise de mână (NU Google Translate).
//
// Cum funcționează:
//  - Aplicația redă tot textul în română. Acest modul traduce
//    runtime nodurile de text + atributele placeholder/title în rusă
//    când limba activă este 'ru'.
//  - Reversibil: textul original (RO) e păstrat într-un WeakMap, deci
//    comutarea înapoi la RO restaurează exact originalul.
//  - Un MutationObserver retraduce conținutul nou redat de app.js.
//  - Șirurile necunoscute rămân în română (niciodată traduse automat).
//
// Ca să adaugi/corectezi o traducere: editează DICT (potrivire pe șir
// întreg, cea mai bună calitate) sau PHRASES (fragmente reutilizabile).
// ============================================================
(function () {
  'use strict';

  var LANG_KEY = 'dental-lab-lang';
  var lang = localStorage.getItem(LANG_KEY) || 'ro';
  var applying = false;
  var obs = null;                 // MutationObserver (deconectat în timpul scrierilor proprii)
  var origText = new WeakMap();   // textNode -> șir RO original
  var lastSet = new WeakMap();    // textNode -> ultima valoare scrisă de noi
  var origAttr = new WeakMap();   // element -> { attr: șir RO original }

  // ── Plural rusesc: 1 → one, 2-4 → few, 5-20/0 → many ─────────
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  // Reguli sensibile la număr: „N lucrări" → plural corect.
  var COUNT_RULES = [
    { re: /(\d+)\s+lucr(?:ări|are)/g, f: ['работа', 'работы', 'работ'] },
    { re: /(\d+)\s+zile?/g,          f: ['день', 'дня', 'дней'] },
    { re: /(\d+)\s+dinți/g,          f: ['зуб', 'зуба', 'зубов'] },
    { re: /(\d+)\s+clinici/g,        f: ['клиника', 'клиники', 'клиник'] },
    { re: /(\d+)\s+tehnicieni/g,     f: ['техник', 'техника', 'техников'] },
    { re: /(\d+)\s+priorități/g,     f: ['приоритет', 'приоритета', 'приоритетов'] },
    { re: /(\d+)\s+încercări rămase/g, f: ['попытка осталась', 'попытки осталось', 'попыток осталось'] },
    { re: /(\d+)\s+cazuri legate/g,  f: ['связанное дело', 'связанных дела', 'связанных дел'] },
    { re: /(\d+)\s+necitite/g,       f: ['непрочитанное', 'непрочитанных', 'непрочитанных'] },
    { re: /(\d+)\s+tipuri de lucrări/g, f: ['тип работ', 'типа работ', 'типов работ'] }
  ];

  // ── Dicționar pe șir întreg (RO → RU) — cea mai bună calitate ──
  var DICT = {
    // Sidebar / navigație
    'Workflow': 'Рабочий процесс', 'Acasă': 'Главная', 'Lucrări': 'Работы',
    'Calendar': 'Календарь', 'Arhivă': 'Архив', 'Statistici': 'Статистика',
    'Date': 'Данные', 'Clinici': 'Клиники', 'Echipa': 'Команда',
    'WorkDrive': 'WorkDrive', 'Termeni': 'Сроки', 'Activitate': 'Активность',
    'Deconectare': 'Выход', 'Administrator': 'Администратор', 'Tehnician': 'Техник',
    'Clinică': 'Клиника', 'Online': 'В сети', 'Ieșit': 'Отошёл', 'Offline': 'Не в сети',
    'Setări': 'Настройки', 'Schimbă rol': 'Сменить роль',

    // Dashboard / acțiuni
    'Dashboard lucrări': 'Панель работ', 'Vezi toate': 'Показать все',
    'Azi': 'Сегодня', 'Mâine': 'Завтра', 'În proces CAM': 'В процессе CAM', 'În proces Ceramică': 'В процессе Керамика',
    'La probă': 'На примерке', 'Probă aprobată': 'Примерка одобрена', 'Neîncepute': 'Не начатые',
    'De rezolvat prima dată': 'Решить в первую очередь',
    'date finale azi': 'финальные даты сегодня', 'date finale mâine': 'финальные даты завтра', 'în lucru la CAM': 'в работе на CAM',
    'în lucru la Ceramică': 'в работе на Керамике', 'așteaptă clinică': 'ждёт клинику',
    'revine la designer': 'возвращается дизайнеру', 'pornește lucrarea': 'начать работу',
    'Nicio lucrare încă. Adaugă primul caz real din butonul Caz nou.':
      'Пока нет работ. Добавьте первое дело кнопкой «Новое дело».',

    // Tabel — antet + acțiuni
    'Nume': 'Имя', 'Tip': 'Тип', 'Acțiuni': 'Действия', 'Intrată': 'Поступление',
    'Probă': 'Примерка', 'Finală': 'Финал', 'Prioritate': 'Приоритет',
    'Etape lab': 'Этапы лаб.', 'Etapă': 'Этап', 'Notițe': 'Заметки',
    'Acțiuni ▾': 'Действия ▾', 'Editare completă': 'Полное редактирование',
    'Previzualizează PDF': 'Просмотр PDF', 'Descarcă PDF': 'Скачать PDF',
    'Atașează fișiere': 'Прикрепить файлы', 'Deschide cazul': 'Открыть дело',
    'Arhivează': 'Архивировать', 'Clear all → Neînceput': 'Сбросить всё → Не начато',
    'Marchează expediat': 'Отметить отправленным', 'Șterge lucrarea': 'Удалить работу',
    'Nicio lucrare pentru filtrul curent.': 'Нет работ по текущему фильтру.',
    '+ Notiță': '+ Заметка', 'Adaugă notiță': 'Добавить заметку',
    'restant': 'просрочено', 'gata': 'готово',

    // Priorități
    'urgent': 'срочно', 'mediu': 'средне', 'reusim': 'успеваем',
    '🔴 Urgent': '🔴 Срочно', '🟠 Mediu': '🟠 Средне', '🟢 Reusim': '🟢 Успеваем',

    // Etape (STAGES) + stări publice
    'Design': 'Дизайн', 'La print': 'На печать', 'Print finisat': 'Печать готова',
    'CAM': 'CAM', 'CAM finisat': 'CAM готов', 'La bare': 'На балки',
    'Prelucrare': 'Обработка', 'Ceramică': 'Керамика', 'Terminat': 'Завершено',
    'Trimis': 'Отправлено', 'Neînceput': 'Не начато', 'Finalizat': 'Завершено',
    'Finalizat ✓': 'Завершено ✓', 'Expediată': 'Отправлено',
    'Aștept aprobare design': 'Ожидает одобрения дизайна',
    'Așteaptă răspuns': 'Ожидает ответа', 'Bare finalizate': 'Балки готовы',
    'În așteptarea barelor': 'В ожидании балок', 'Probă aprobată': 'Примерка одобрена',

    // Pipeline kanban
    '+ Caz nou la această etapă': '+ Новое дело на этом этапе',
    'Restrânge coloana': 'Свернуть колонку', 'Restrânge/extinde': 'Свернуть/развернуть',
    '— neînceput': '— не начато', '— neasignat': '— не назначено',
    'Mută la etapă': 'Переместить на этап', 'Colaboratori...': 'Соисполнители...',

    // Portal clinică
    'Portalul clinicii': 'Портал клиники', 'Termenii laboratorului': 'Сроки лаборатории',
    'Vezi panoul echipei': 'Панель команды', '+ Caz nou': '+ Новое дело',
    'Active': 'Активные', 'Terminate': 'Завершённые', 'Expediate': 'Отправленные',
    'Caz': 'Дело', 'Pacient': 'Пациент', 'Tip lucrare': 'Тип работы',
    'Aprobă probă': 'Одобрить примерку', 'Confirmă expediere': 'Подтвердить отправку',
    'Adaugă notă': 'Добавить заметку', 'Editează': 'Редактировать', 'Notă': 'Заметка',
    'Nu există lucrări în această secțiune.': 'В этом разделе нет работ.',
    'Arhiva clinicii': 'Архив клиники',
    'Consultați timpii de execuție înainte de a seta data finală.':
      'Проверьте сроки выполнения перед установкой финальной даты.',
    'Lucrări terminate și expediate pentru această clinică.':
      'Завершённые и отправленные работы этой клиники.',
    'Clinică inexistentă': 'Клиника не найдена',
    'Notă nouă': 'Новая заметка', 'Scrie o notă...': 'Напишите заметку...',
    'Nicio notă.': 'Нет заметок.', 'Trimite': 'Отправить', 'Anulează': 'Отмена',

    // Detaliu caz
    '← Pipeline': '← Поток', '← Portal clinică': '← Портал клиники',
    'Detalii caz': 'Детали дела', 'Culoare': 'Цвет', 'Implant': 'Имплант',
    'Amprentă': 'Слепок', 'Fără probă': 'Без примерки',
    'Schema dentară (FDI)': 'Зубная схема (FDI)', 'Fișă de laborator': 'Лабораторный лист',
    'Descarcă': 'Скачать', 'Previzualizează': 'Предпросмотр',
    'Note & activitate': 'Заметки и активность', 'Adaugă o notă...': 'Добавьте заметку...',
    'Nicio notă adăugată.': 'Заметок пока нет.',
    'Fișiere atașate': 'Прикреплённые файлы', '+ Atașează fișier': '+ Прикрепить файл',
    'Niciun fișier atașat încă.': 'Файлов пока нет.',
    'Marchează etapă completă': 'Отметить этап завершённым',
    'Mută la etapă...': 'Переместить на этап...',
    'Fișă PDF — Vizualizează': 'PDF лист — Просмотр', 'Fișă PDF — Descarcă': 'PDF лист — Скачать',
    'Caz inexistent.': 'Дело не найдено.', 'Înapoi': 'Назад',
    'Click pentru a schimba starea': 'Нажмите, чтобы изменить статус',
    'în lucru': 'в работе', 'la probă': 'на примерке', 'probă aprobată': 'примерка одобрена',
    'așteaptă bare': 'ждёт балки', 'bare finalizate': 'балки готовы',
    'așteaptă răspuns': 'ждёт ответа', 'așteaptă aprobare': 'ждёт одобрения',
    'în așteptare': 'в ожидании',

    // Dinți
    'Coroană': 'Коронка', 'Pe implant': 'На имплант', 'Emax': 'Emax', 'Fațetă': 'Винир',
    'Maxilar complet': 'Верхняя челюсть полностью', 'Mandibulă completă': 'Нижняя челюсть полностью',
    'Șterge tot': 'Очистить всё', 'Niciun dinte selectat': 'Зубы не выбраны',
    'Schema dentară': 'Зубная схема', 'opțional': 'необязательно',

    // Modale / caz nou
    'Caz nou': 'Новое дело', 'Salvează': 'Сохранить',
    'Salvează modificările': 'Сохранить изменения', 'Salvează colaboratori': 'Сохранить соисполнителей',
    'Flux organizat': 'Организованный процесс', 'Pacient & clinică': 'Пациент и клиника',
    'Prenume': 'Фамилия', 'Medic': 'Врач', 'Lucrare': 'Работа',
    'Tip implant': 'Тип импланта', 'Tip amprentă': 'Тип слепка',
    'Planificare': 'Планирование', 'Termeni laborator': 'Сроки лаборатории',
    'Deschide tabelul complet': 'Открыть полную таблицу',
    'Fișiere & note': 'Файлы и заметки', 'Adaugă fișiere': 'Добавить файлы', 'Note': 'Заметки',
    'Mută cazul': 'Переместить дело', 'Etapă nouă': 'Новый этап', 'Mută': 'Переместить',
    'Note / indicații speciale': 'Заметки / особые указания',
    'clinică și medic': 'клиника и врач', 'tip, culoare, dinți': 'тип, цвет, зубы',
    'intrare, probă, finală': 'поступление, примерка, финал', 'atașări și note': 'вложения и заметки',
    'PDF / STL': 'PDF / STL', 'Adaugă fișa sau scanarea': 'Добавьте лист или скан',

    // Portal tehnician
    'Tabel lucrări': 'Таблица работ', 'În lucru': 'В работе', 'Trimise la probă': 'Отправлено на примерку',
    'În întârziere': 'Просрочено', 'În lucru la tine': 'У вас в работе',
    'Trimit la aprobare': 'Отправить на одобрение', 'Design finalizat': 'Дизайн завершён',
    'Finalizează': 'Завершить', 'Marchează probă aprobată': 'Отметить примерку одобренной',
    'Probe aprobate': 'Одобренные примерки', 'Finalizează design': 'Завершить дизайн',
    'În așteptare răspuns clinică': 'Ожидание ответа клиники',
    'Răspuns primit · continuă': 'Ответ получен · продолжить',
    'Aprobat — continuă': 'Одобрено — продолжить', 'Necesită modificări': 'Требует изменений',
    'Așteaptă să fie revendicate': 'Ожидают, чтобы их взяли', 'Pun în proces': 'Взять в работу',
    'Finalizate de mine': 'Завершено мной', 'Redeschide': 'Переоткрыть',
    'Probă AZI': 'Примерка СЕГОДНЯ', 'Probă mâine': 'Примерка завтра',
    'Finală AZI': 'Финал СЕГОДНЯ', 'Finală mâine': 'Финал завтра',
    'probă': 'примерка', 'finală': 'финал', 'finalizat': 'завершено',
    'Nicio lucrare activă': 'Нет активных работ',
    'Nicio lucrare trimisă la probă': 'Нет работ, отправленных на примерку',
    'Nicio probă aprobată': 'Нет одобренных примерок',
    'Nicio lucrare în așteptarea barelor': 'Нет работ в ожидании балок',
    'Nicio lucrare în așteptare răspuns': 'Нет работ в ожидании ответа',
    'Nicio lucrare în așteptare aprobare': 'Нет работ в ожидании одобрения',
    'Nicio lucrare de revendicat': 'Нет работ, которые можно взять',
    'Nicio lucrare finalizată încă': 'Завершённых работ пока нет',
    'Nimic critic — la zi cu lucrurile urgente': 'Ничего срочного — всё под контролем',
    'Panoul Acasă este disponibil doar pentru conturile tehnicienilor.':
      'Главная панель доступна только для учётных записей техников.',

    // Notificări
    'Notificări': 'Уведомления', 'Marchează citite': 'Отметить прочитанными',
    'Probă azi': 'Примерка сегодня', 'Lucrare restantă': 'Просроченная работа',
    'Termen apropiat': 'Близкий срок', 'Probă de aprobat': 'Примерка для одобрения',
    'Aprobă designul': 'Одобрить дизайн', 'Lucrare nouă de revendicat': 'Новая работа, можно взять',
    'oră nesetată': 'время не указано',

    // TODO echipă
    'Task-uri rapide ale echipei': 'Быстрые задачи команды', 'Task-uri rapide': 'Быстрые задачи', 'taskuri': 'задачи',
    'Echipă': 'Команда', 'Adaugă task rapid… (Enter)': 'Добавить задачу… (Enter)',
    'Adaugă': 'Добавить', 'Finalizate': 'Завершённые',
    'Niciun task activ. Adaugă unul mai sus.': 'Нет активных задач. Добавьте выше.',
    'Niciun task finalizat încă.': 'Завершённых задач пока нет.',
    'Marchează finalizat': 'Отметить завершённым', 'Redeschide ': 'Переоткрыть ',
    'Șterge definitiv': 'Удалить навсегда',

    // Statistici
    'Export PNG': 'Экспорт PNG', 'Export PDF': 'Экспорт PDF', 'Export CSV': 'Экспорт CSV',
    'Total': 'Всего', 'La timp': 'Вовремя', 'Trimise': 'Отправлено',
    'Lucrări pe tip (per ansamblu)': 'Работы по типу (всего)',
    'Cazuri pe etapă': 'Дела по этапам', 'Cazuri pe clinică': 'Дела по клиникам',
    'Pe tehnician': 'По технику', 'La timp vs întârziere': 'Вовремя и с опозданием',
    'Tipuri de lucrări per clinică': 'Типы работ по клиникам',
    'Întârziate': 'С опозданием', 'Cel mai mult:': 'Больше всего:',
    'Termeni & respectarea lor (per clinică)': 'Сроки и их соблюдение (по клиникам)',
    'Lucrări': 'Работы', 'Zile medii oferite': 'Среднее кол-во дней',
    'Min. recomandat': 'Мин. рекомендуемый', '% urgentate': '% срочных', '% respectate': '% в срок',
    'Nu există încă lucrări cu termeni măsurabili (au nevoie de dată de intrare + finală + tip recunoscut).':
      'Пока нет работ с измеримыми сроками (нужны дата поступления + финал + распознанный тип).',

    // Clinici / Echipa
    '+ Clinică nouă': '+ Новая клиника', 'Administrare clinici': 'Управление клиниками',
    'Gata': 'Готово', 'Restant': 'Просрочено', 'Șterge': 'Удалить',
    '+ Angajat nou': '+ Новый сотрудник', 'Conturi angajați': 'Учётные записи сотрудников',
    'activ': 'активно', 'terminat': 'завершено', 'Fără cont': 'Нет учётной записи',
    'Creează cont': 'Создать учётную запись', '✓ activ': '✓ активна',
    'Designer CAD': 'CAD-дизайнер', 'Tehnician CAM': 'CAM-техник',
    'Tehnician ceramică': 'Техник по керамике', 'Tehnician prelucrare': 'Техник по обработке',
    'Clinică nouă': 'Новая клиника', 'Angajat nou': 'Новый сотрудник',
    'Nume clinică *': 'Название клиники *', 'Doctor (opțional)': 'Врач (необязательно)',
    'Telefon (opțional)': 'Телефон (необязательно)', 'Nume complet *': 'Полное имя *',
    'Secție *': 'Отдел *', 'Username': 'Имя пользователя',
    'Creează cont de autentificare': 'Создать учётную запись для входа',
    'Se salvează...': 'Сохранение...', 'Se verifică...': 'Проверка...',

    // Login
    'Autentificare': 'Вход', 'Utilizator': 'Пользователь', 'Parolă': 'Пароль',
    'Intră în cont': 'Войти', 'Nu ai cont? Contactează administratorul laboratorului.':
      'Нет учётной записи? Свяжитесь с администратором лаборатории.',
    'Sistem privat · acces numai prin invitație': 'Частная система · доступ только по приглашению',
    'Precizie digitală pentru fiecare caz.': 'Цифровая точность для каждого дела.',
    'Portal privat pentru clinici și echipa laboratorului.':
      'Частный портал для клиник и команды лаборатории.',
    'Laborator stomatologic · Chișinău': 'Зуботехническая лаборатория · Кишинёв',
    'Completați toate câmpurile': 'Заполните все поля',
    'Sistemul necesită conexiune Supabase. Contactați administratorul.':
      'Системе требуется подключение Supabase. Свяжитесь с администратором.',

    // Termeni
    'Luni - Vineri': 'Понедельник – Пятница',
    'Consultați termenii înainte de a seta data finală.':
      'Проверьте сроки перед установкой финальной даты.',
    'Previzualizare clinică': 'Предпросмотр клиники', 'Înapoi la clinică': 'Назад к клинике',
    '+ Rând nou': '+ Новая строка', 'Reset default': 'Сбросить по умолчанию',
    'Salvează termeni': 'Сохранить сроки', 'Categorie': 'Категория', 'Serviciu': 'Услуга',
    'Timp execuție': 'Срок выполнения', 'Min. urgent': 'Мин. срочно',
    'pagină informativă': 'информационная страница',

    // Activity log
    'Istoricul activității': 'История активности',
    'Toate acțiunile înregistrate în sistem': 'Все действия, записанные в системе',
    'Se încarcă...': 'Загрузка...', 'Nicio activitate înregistrată.': 'Нет записанной активности.',
    'Toți utilizatorii': 'Все пользователи', 'Toate operațiunile': 'Все операции', 'Reset': 'Сброс',

    // Calendar
    'Astăzi': 'Сегодня', 'Toate': 'Все', 'Neincepute': 'Не начатые',
    'În proces': 'В процессе', 'azi': 'сегодня', 'mâine': 'завтра',

    // View tabs + subbar (dashboard)
    'Tabel': 'Таблица', 'Lucrările mele': 'Мои работы', 'Săptămâna asta': 'Эта неделя',
    'Toate': 'Все', 'În întârziere': 'Просрочено', 'Probe azi/mâine': 'Примерки сегодня/завтра',

    // Meniuri sortare (dropdown)
    'Pe luni (implicit)': 'По месяцам (по умолчанию)',
    'Data probei — crescător': 'Дата примерки — по возрастанию',
    'Data probei — descrescător': 'Дата примерки — по убыванию',
    'Data finală — crescător': 'Финальная дата — по возрастанию',
    'Data finală — descrescător': 'Финальная дата — по убыванию',

    // Diverse / filtre
    'Toate clinicile': 'Все клиники', 'pe luni': 'по месяцам',
    'data probei crescător': 'дата примерки по возрастанию',
    'data probei descrescător': 'дата примерки по убыванию',
    'data finală crescător': 'финальная дата по возрастанию',
    'data finală descrescător': 'финальная дата по убыванию',
    'Date live neîncărcate': 'Данные не загружены',
    'Sortare': 'Сортировка', 'Pe luni': 'По месяцам',
    'Dată arhivă ↓ (recent)': 'Дата архива ↓ (недавние)',
    'Dată arhivă ↑ (vechi)': 'Дата архива ↑ (старые)',
    'Dată arhivă — crescător': 'Дата архива — по возрастанию',
    'Dată arhivă — descrescător': 'Дата архива — по убыванию',
    'Mele': 'Мои', 'Întârziere': 'Опоздание', 'Săptămâna': 'Неделя',

    // Placeholdere + tooltipuri (atribute placeholder / title)
    'Caută pacient, clinică, #caz...': 'Поиск: пациент, клиника, #дело...',
    'Caută pacient, clinică sau tip…': 'Поиск: пациент, клиника или тип…',
    'Caută pacient, clinică sau tip...': 'Поиск: пациент, клиника или тип...',
    'Adaugă o notă nouă...': 'Добавьте новую заметку...',
    'Dr. Nume': 'Др. Имя', 'Nume pacient sau caz #': 'Имя пациента или дело #',
    'Nume pacient': 'Имя пациента', 'Numele clinicii': 'Название клиники',
    'Nume și prenume': 'Имя и фамилия', 'Introduceți parola temporară': 'Введите временный пароль',
    'ex. ZR FULL — sau scrie alt tip': 'напр. ZR FULL — или введите другой тип',
    'ex: DENT SMILE': 'напр.: DENT SMILE', 'ex: Ion Popescu': 'напр.: Иван Петров',
    'utilizator': 'пользователь',
    'Meniu': 'Меню', 'Notificări': 'Уведомления',
    'Click pentru a marca în lucru': 'Нажмите, чтобы отметить «в работе»',
    'Etapa curentă · click pentru a o revendica': 'Текущий этап · нажмите, чтобы взять',
    'Restrânge/extinde': 'Свернуть/развернуть', 'Acțiuni': 'Действия',
    'Task-uri rapide ale echipei': 'Быстрые задачи команды',
    'Redeschide': 'Переоткрыть', 'Șterge definitiv': 'Удалить навсегда'
  };

  // ── Fragmente reutilizabile (RO → RU), aplicate ca fallback ──
  // Folosite când nu există potrivire pe șir întreg (ex. texte compuse).
  var PHRASES = {
    'trimise la probă': 'отправлено на примерку', 'în așteptarea barelor': 'в ожидании балок',
    'lucrări în curs': 'работ в процессе', 'probe aprobate': 'одобренных примерок',
    'Portalul clinicii': 'Портал клиники', 'de revendicat': 'можно взять',
    // chip-uri filtre (text compus: „Clinică: toate", „Sortare: pe luni")
    'data probei crescător': 'дата примерки по возрастанию',
    'data probei descrescător': 'дата примерки по убыванию',
    'data finală crescător': 'финальная дата по возрастанию',
    'data finală descrescător': 'финальная дата по убыванию',
    'Sortare:': 'Сортировка:', 'pe luni': 'по месяцам', 'toate': 'все', 'implicit': 'по умолчанию',
    'Expediate': 'Отправленные',
    'în curs': 'в процессе', 'active': 'активных', 'expediate': 'отправлено',
    'lucrări': 'работ', 'lucrare': 'работа',
    'tehnicieni': 'техников', 'clinici': 'клиник', 'cazuri legate': 'связанных дел',
    'priorități': 'приоритета', 'necitite': 'непрочитанных', 'culoare': 'цвет',
    'Probă': 'Примерка', 'Finală': 'Финал', 'Intrată': 'Поступление',
    'finalizat': 'завершено', 'probă': 'примерка', 'finală': 'финал', 'restant': 'просрочено',
    'Medic:': 'Врач:', 'Caz #': 'Дело #', 'Caz': 'Дело', 'dinți': 'зубов',
    'Pacient:': 'Пациент:', 'Clinică:': 'Клиника:'
  };

  // Construim un singur regex din cheile PHRASES (cele mai lungi primele).
  var PHRASE_RE = null;
  (function buildPhraseRe() {
    var keys = Object.keys(PHRASES).sort(function (a, b) { return b.length - a.length; });
    if (!keys.length) return;
    var esc = keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    PHRASE_RE = new RegExp(esc.join('|'), 'g');
  })();

  function translateString(raw) {
    if (raw == null) return raw;
    var str = String(raw);
    var m = str.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var lead = m[1], core = m[2], trail = m[3];
    if (!core) return raw;
    if (Object.prototype.hasOwnProperty.call(DICT, core)) return lead + DICT[core] + trail;
    var s = core;
    for (var i = 0; i < COUNT_RULES.length; i++) {
      var r = COUNT_RULES[i];
      s = s.replace(r.re, function (_mm, num) {
        return num + ' ' + plural(parseInt(num, 10), r.f[0], r.f[1], r.f[2]);
      });
    }
    if (PHRASE_RE) {
      s = s.replace(PHRASE_RE, function (mm) {
        return Object.prototype.hasOwnProperty.call(PHRASES, mm) ? PHRASES[mm] : mm;
      });
    }
    return lead + s + trail;
  }

  // ── DOM ──────────────────────────────────────────────────────
  // Nu coborâm în aceste taguri pentru text (script/stil + conținut editabil).
  // Atributele placeholder/title se traduc însă pe ORICE element (inclusiv input).
  var SKIP_DESCEND = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };

  function translateTextNode(node) {
    var cur = node.nodeValue;
    var raw = origText.get(node);
    if (raw === undefined) {
      raw = cur; origText.set(node, cur);
    } else if (cur !== raw && cur !== lastSet.get(node)) {
      // Aplicația a schimbat acest nod (valoare nouă) — re-stabilim originalul.
      raw = cur; origText.set(node, cur);
    }
    var target = lang === 'ru' ? translateString(raw) : raw;
    if (node.nodeValue !== target) node.nodeValue = target;
    lastSet.set(node, target);
  }

  function translateAttr(el, attr) {
    if (!el.hasAttribute(attr)) return;
    var store = origAttr.get(el);
    if (!store) { store = {}; origAttr.set(el, store); }
    if (!(attr in store)) store[attr] = el.getAttribute(attr);
    var raw = store[attr];
    var target = lang === 'ru' ? translateString(raw) : raw;
    if (el.getAttribute(attr) !== target) el.setAttribute(attr, target);
  }

  function walk(node) {
    if (node.nodeType === 3) { translateTextNode(node); return; }
    if (node.nodeType !== 1) return;
    if (node.id === 'i18nToggle') return;       // nu traducem comutatorul
    if (node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE' || node.nodeName === 'NOSCRIPT') return;
    translateAttr(node, 'placeholder');
    translateAttr(node, 'title');
    if (SKIP_DESCEND[node.nodeName]) return;     // nu coborâm în conținut (ex. textarea)
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function retranslate(skipWalk) {
    if (!document.body) return;
    applying = true;
    if (obs) obs.disconnect();                 // nu reacționăm la propriile scrieri
    try { if (!skipWalk) walk(document.body); buildToggle(); }
    finally {
      if (obs) obs.observe(document.body, { childList: true, characterData: true, subtree: true });
      applying = false;
    }
  }

  // ── Comutator RO/RU ──────────────────────────────────────────
  var FLOAT_CSS = 'position:fixed;right:14px;bottom:14px;z-index:99999;display:flex;gap:2px;' +
    'align-items:center;padding:6px 4px;border-radius:999px;border:1px solid rgba(0,0,0,.18);' +
    'background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);font:600 12px system-ui,sans-serif;' +
    'cursor:pointer;user-select:none;color:#111';
  var INLINE_CSS = 'display:inline-flex;gap:2px;align-items:center;vertical-align:middle;' +
    'margin-left:8px;padding:5px 4px;border-radius:999px;border:1px solid rgba(0,0,0,.18);' +
    'background:#fff;font:600 12px system-ui,sans-serif;cursor:pointer;user-select:none;color:#111';

  function buildToggle() {
    var b = document.getElementById('i18nToggle');
    if (!b) {
      b = document.createElement('button');
      b.id = 'i18nToggle';
      b.type = 'button';
      b.setAttribute('aria-label', 'Limbă / Язык');
      b.addEventListener('click', function () {
        setLang(lang === 'ru' ? 'ro' : 'ru');
        renderToggle(b);
      });
      document.body.appendChild(b);
      renderToggle(b);
    }
    placeToggle(b);
    return b;
  }

  // Lângă butonul Export CSV (dashboard / arhivă / statistici) dacă există;
  // altfel rămâne plutitor în colțul din dreapta-jos.
  function placeToggle(b) {
    b = b || document.getElementById('i18nToggle');
    if (!b) return;
    var anchor = document.getElementById('exportCsvBtn') ||
                 document.getElementById('arExport') ||
                 document.getElementById('statsExportCsv');
    if (anchor) {
      if (anchor.nextElementSibling !== b || b.parentNode !== anchor.parentNode) {
        b.style.cssText = INLINE_CSS;
        anchor.insertAdjacentElement('afterend', b);
      }
    } else if (b.parentNode !== document.body || b.style.position !== 'fixed') {
      b.style.cssText = FLOAT_CSS;
      document.body.appendChild(b);
    }
  }
  function renderToggle(b) {
    var on = 'background:#111;color:#fff', off = 'background:transparent;color:#666';
    b.innerHTML =
      '<span style="padding:3px 9px;border-radius:999px;' + (lang === 'ro' ? on : off) + '">RO</span>' +
      '<span style="padding:3px 9px;border-radius:999px;' + (lang === 'ru' ? on : off) + '">RU</span>';
  }

  function setLang(l) {
    lang = (l === 'ru') ? 'ru' : 'ro';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.documentElement.lang = lang;
    retranslate();
  }

  // ── Observator pentru conținut redat dinamic de app.js ───────
  // Rulăm SINCRON (microtask, înainte de paint) ca să nu se vadă textul RO
  // pâlpâind înainte de traducere. retranslate() deconectează observatorul
  // pe durata scrierilor proprii, deci nu există buclă.
  function onMutations(muts) {
    if (applying) return;
    for (var i = 0; i < muts.length; i++) {
      if ((muts[i].addedNodes && muts[i].addedNodes.length) || muts[i].type === 'characterData') {
        // În RO nu e nimic de tradus (conținutul e deja RO) — doar repoziționăm
        // comutatorul. În RU traducem conținutul nou redat.
        retranslate(lang !== 'ru');
        return;
      }
    }
  }

  function init() {
    document.documentElement.lang = lang;
    obs = new MutationObserver(onMutations);
    // buildToggle + traducere inițială (retranslate gestionează observatorul)
    retranslate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expunere minimă pentru depanare / extindere
  window.PCAD_I18N = { setLang: setLang, get lang() { return lang; }, DICT: DICT, PHRASES: PHRASES, retranslate: retranslate, translate: translateString };
})();
