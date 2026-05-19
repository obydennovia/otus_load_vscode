import http from 'k6/http';
import { check, group } from 'k6';
import { parseHTML } from 'k6/html';
import { SharedArray } from 'k6/data';

// Общие заголовки для всего скрипта
const globalHeaders = {
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Priority': 'u=4',
  'Accept-Encoding': 'gzip, deflate',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Константы
const BASE_URL = 'http://webtours.load-test.ru:1080'; // Базовый URL WebTours

// Очистка Cookie
export function clearCookiesAction() {
  const jar = http.cookieJar();
  jar.clear(BASE_URL);
}

// Передаем заголовки в параметры запроса
const baseHeaders = {
  headers: globalHeaders,
};

// Query-параметры
const queryParams = {
  numPassengers: "1",
  firstName: "Ivan",
  lastName: "Obydennov",
  address1: "Street",
  address2: "City",
  pass1: "Ivan Obydennov",
  creditCard: "1234",
  expDate: "12/3000"
};

// Извлечение логина и пароля в массив credentials
const credentials = new SharedArray('Get data JSON', function(){
  const file = JSON.parse(open('./webtours_users.json'));
  return file.users;
});

export const options = {
  scenarios: { 
    webtours_ramping: {
      executor: 'ramping-arrival-rate',
      preAllocatedVUs: 13,
      maxVUs: 15,
      startRate: 0,
      timeUnit: '1s',
      stages: [
        { target: 6, duration: '0s' }, 
        { target: 6, duration: '10m' },
        { target: 7, duration: '0s' },
        { target: 7, duration: '10m' },
        { target: 8, duration: '0s' },
        { target: 8, duration: '10m' },
        { target: 9, duration: '0s' },
        { target: 9, duration: '10m' },
        { target: 10, duration: '0s' },
        { target: 10, duration: '10m' },
        { target: 11, duration: '0s' },
        { target: 11, duration: '10m' },
        { target: 12, duration: '0s' },
        { target: 12, duration: '10m' },
        { target: 0, duration: '0s' },
      ],
    },
  },
};

export default function () {
  clearCookiesAction();
  
  // Получение userSession с RootPage
  const userSession = rootPageTransaction();
  
  // Выбор рандомного пользователя из файла с пользователями
  const randomUser = credentials[Math.floor(Math.random() * credentials.length)];
  loginTransaction(userSession, randomUser.username, randomUser.password);

  // Полуение списка рейсов
  const flightData = flightTransaction();
  
  // Покупка билета в одну сторону
  oneWayTicketTransaction(flightData);
  
  // Возвращение на RootPage
  rootPageTransaction();
}

/* ---------------------------------------------- */
/* --- Begin Root Page Transaction Controller --- */
/* ---------------------------------------------- */

export function rootPageTransaction() {
  let userSession = null;

  group('Root Page Transaction', () => {
    
    // Заходим на главную страницу, чтобы сервер выставил куки
    let mainPage = http.get(`${BASE_URL}/webtours/`, { headers: baseHeaders });
    check(mainPage, { 'main page status is 200': (r) => r.status === 200 });

    // Вход на RootPage (welcome.pl)
    const enterHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/webtours/`
    });
    
    let enterRootPage = http.get(`${BASE_URL}/cgi-bin/welcome.pl?signOff=true`, { 
      headers: enterHeaders 
    });
    
    check(enterRootPage, { 
      'welcome.pl status is 200': (r) => r.status === 200 
    });

    // Получение UserSession (nav.pl)
    const navHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/welcome.pl?signOff=true`
    });

    let navPage = http.get(`${BASE_URL}/cgi-bin/nav.pl?in=home`, { 
      headers: navHeaders 
    });

    const isNavOk = check(navPage, { 
      'nav.pl status is 200': (r) => r.status === 200 
    });

    if (isNavOk) {
      const match = navPage.body.match(/name="userSession"\s+value="([^"]+)"/) 
                || navPage.body.match(/value="([^"]+)"\s+name="userSession"/);

      if (match && match[1]) {
        userSession = match[1];
        console.log(`userSession найден: ${userSession}`);
      } else {
        console.error('userSession не найден');
      }
    }

  });

  return userSession;
}

/* ------------------------------------------ */
/* --- Begin Login Transaction Controller --- */
/* ------------------------------------------ */

export function loginTransaction(userSession, username, password) {
  group('Login Transaction', () => {
    
    // Проверка входных данных
    if (!userSession || !username || !password) {
      console.error(`Login failed: userSession=${userSession}, username=${username}, password=${password}`);
      return;
    }

    // Начало авторизации
    const loginHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/nav.pl?in=home`,
      'Origin': BASE_URL,
      'Upgrade-Insecure-Requests': '1',
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    const formData = {
      'userSession': userSession,
      'username': username,
      'password': password,
      'login.x': '74',
      'login.y': '4',
      'JSFormSubmit': 'off',
    };

    let beginAuthorization = http.post(`${BASE_URL}/cgi-bin/login.pl?in=home`, formData, {
      headers: loginHeaders
    });

    check(beginAuthorization, {
      'login.pl POST status is 200': (r) => r.status === 200
    });

    // Проверка userSession
    const checkHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/login.pl`
    });

    let checkAuthorization = http.get(`${BASE_URL}/cgi-bin/nav.pl?page=menu&in=home`, {
      headers: checkHeaders
    });

    check(checkAuthorization, {
      'nav.pl GET status is 200': (r) => r.status === 200
    });

    // Завершение авторизации
    const endHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/login.pl`
    });

    let endAuthorization = http.get(`${BASE_URL}/cgi-bin/login.pl?intro=true`, {
      headers: endHeaders
    });

    check(endAuthorization, {
      'login.pl GET status is 200': (r) => r.status === 200
    });
  });
}

/* ---------------------------------------- */
/* --- End Login Transaction Controller --- */
/* ---------------------------------------- */

/* -------------------------------------------- */
/* --- Begin Flight Transaction Controller --- */
/* -------------------------------------------- */

export function flightTransaction() {
  let flightData = {
    cityList: [],
    departDate: null,
    returnDate: null
  };

  group('Flight Transaction', () => {
    
    // Вход на страницу Flights (welcome.pl)
    const flightPageHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/nav.pl?page=menu&in=flights`
    });

    let getFlightPage = http.get(`${BASE_URL}/cgi-bin/welcome.pl?page=search`, {
      headers: flightPageHeaders
    });

    check(getFlightPage, {
      'welcome.pl?page=search status is 200': (r) => r.status === 200
    });

    // Поиск рейса (nav.pl)
    const searchHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/welcome.pl?page=search`
    });

    let searchFlightPage = http.get(`${BASE_URL}/cgi-bin/nav.pl?page=menu&in=flights`, {
      headers: searchHeaders
    });

    check(searchFlightPage, {
      'nav.pl?page=menu&in=flights status is 200': (r) => r.status === 200
    });

    // Получение списка городов и дат (reservations.pl)
    const citiesHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/welcome.pl?page=search`
    });

    let getFlightCities = http.get(`${BASE_URL}/cgi-bin/reservations.pl?page=welcome`, {
      headers: citiesHeaders
    });

    const isCitiesOk = check(getFlightCities, {
      'reservations.pl status is 200': (r) => r.status === 200
    });

    if (isCitiesOk) {
      const bodyText = getFlightCities.body;

      // Находим все города из тегов <option>
      const cityRegex = /<option.*?value=".*?".*?>(.*?)<\/option>/g;
      let match;
      while ((match = cityRegex.exec(bodyText)) !== null) {
        flightData.cityList.push(match[1]);
      }

      // Находим системную дату отправления (departDate)
      const departMatch = bodyText.match(/name="departDate"\s+value="([^"]+)"/);
      if (departMatch) {
        flightData.departDate = departMatch[1];
      }

      // Находим системную дату возвращения (returnDate)
      const returnMatch = bodyText.match(/name="returnDate"\s+value="([^"]+)"/);
      if (returnMatch) {
        flightData.returnDate = returnMatch[1];
      }

      console.log(`Найдены города отправления и прибытия: ${flightData.cityList.length}`);
      console.log(`Дата вылета: ${flightData.departDate}`);
    }
  });

  return flightData;
}

/* --------------------------------------------------- */
/* --- Begin One Way Ticket Transaction Controller --- */
/* --------------------------------------------------- */

export function oneWayTicketTransaction(flightData) {
  group('One Way Ticket Transaction', () => {
    
    // Вспомогательная функция для выбора случайного элемента из массива
    const getRandomElement = (arr) => {
      if (!arr || arr.length === 0) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    };

    // Выбор городов отправления/прибытия и дат
    const selectHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/reservations.pl?page=welcome`,
      'Origin': BASE_URL,
      'Upgrade-Insecure-Requests': '1',
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    // Проверяем наличие городов перед выбором
    if (!flightData.cityList || flightData.cityList.length === 0) {
      console.error('Ошибка: Список городов пуст!');
      return;
    }

    const departCity = getRandomElement(flightData.cityList);
    const arriveCity = getRandomElement(flightData.cityList);

    console.log(`Город отправления: ${departCity}`);
    console.log(`Город прибытия: ${arriveCity}`);

    const selectData = {
      'advanceDiscount': '0',
      'depart': departCity,
      'departDate': flightData.departDate,
      'arrive': arriveCity,
      'returnDate': flightData.returnDate,
      'numPassengers': queryParams.numPassengers,
      'seatPref': 'None',
      'seatType': 'Coach',
      'findFlights.x': '42',
      'findFlights.y': '6',
      '.cgifields': ['roundtrip', 'seatType', 'seatPref'] 
    };

    let selectCitiesAndDates = http.post(`${BASE_URL}/cgi-bin/reservations.pl`, selectData, {
      headers: selectHeaders
    });

    const isSelectOk = check(selectCitiesAndDates, {
      'selectCitiesAndDates status is 200': (r) => r.status === 200
    });

    let outboundFlights = [];

    if (isSelectOk) {
      const flightRegex = /name="outboundFlight" value="([^"]+)"/g;
      let match;
      while ((match = flightRegex.exec(selectCitiesAndDates.body)) !== null) {
        outboundFlights.push(match[1]);
      }
    }

    const chosenFlight = outboundFlights.length > 0 
      ? getRandomElement(outboundFlights) 
      : '020;351;05/18/2026';

    // Выбор рейса отправления
    const outboundHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/reservations.pl`,
      'Origin': BASE_URL,
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    const outboundData = {
      'outboundFlight': chosenFlight,
      'numPassengers': queryParams.numPassengers,
      'advanceDiscount': '0',
      'seatType': 'Coach',
      'seatPref': 'None',
      'reserveFlights.x': '55',
      'reserveFlights.y': '6'
    };

    let selectOutboundFlights = http.post(`${BASE_URL}/cgi-bin/reservations.pl`, outboundData, {
      headers: outboundHeaders
    });

    check(selectOutboundFlights, {
      'selectOutboundFlights status is 200': (r) => r.status === 200
    });

    // Оплата билета
    const paymentHeaders = Object.assign({}, baseHeaders, {
      'Referer': `${BASE_URL}/cgi-bin/reservations.pl`,
      'Origin': BASE_URL,
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    const paymentData = {
      'firstName': queryParams.firstName,
      'lastName': queryParams.lastName,
      'address1': queryParams.address1,
      'address2': queryParams.address2,
      'pass1': queryParams.pass1,
      'creditCard': queryParams.creditCard,
      'expDate': queryParams.expDate,
      'oldCCOption': '',
      'numPassengers': queryParams.numPassengers,
      'seatType': 'Coach',
      'seatPref': 'None',
      'outboundFlight': chosenFlight,
      'advanceDiscount': '0',
      'returnFlight': '',
      'JSFormSubmit': 'off',
      'buyFlights.x': '73',
      'buyFlights.y': '16',
      '.cgifields': 'saveCC'
    };

    let postPayment = http.post(`${BASE_URL}/cgi-bin/reservations.pl`, paymentData, {
      headers: paymentHeaders
    });

    check(postPayment, {
      'postPayment status is 200': (r) => r.status === 200
    });
  });
}

/* ------------------------------------------------- */
/* --- End One Way Ticket Transaction Controller --- */
/* ------------------------------------------------- */