import http from 'k6/http';

export const options = {
  scenarios: {
    // Сценарий 1: Нагрузка на ya.ru
    yandex_scenario: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1m', // База расчета — запросы в МИНУТУ
      preAllocatedVUs: 5,
      maxVUs: 50,
      stages: [
        { target: 60, duration: '5m' },  // Разгон до 100% профиля (1 RPS)
        { target: 60, duration: '10m' }, // Полка 100% профиля
        { target: 72, duration: '5m' },  // Разгон до 120% профиля (1.2 RPS)
        { target: 72, duration: '10m' }, // Полка 120% профиля
        { target: 0, duration: '0s' },   // Мгновенная остановка
      ],
      exec: 'ya_test', // Имя функции, которую запускает этот сценарий
    },
    // Сценарий 2: Нагрузка на www.ru
    www_scenario: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1m', // База расчета — запросы в МИНУТУ
      preAllocatedVUs: 5,
      maxVUs: 50,
      stages: [
        { target: 120, duration: '5m' },  // Разгон до 100% профиля (2 RPS)
        { target: 120, duration: '10m' }, // Полка 100% профиля
        { target: 144, duration: '5m' },  // Разгон до 120% профиля (2.2 RPS)
        { target: 144, duration: '10m' }, // Полка 120% профиля
        { target: 0, duration: '0s' },    // Мгновенная остановка
      ],
      exec: 'www_test', // Имя функции, которую запускает этот сценарий
    },
  },
};

// Функция для первого сценария (ya.ru)
export function ya_test() {
  http.get('https://ya.ru', {
    tags: { my_custom_tag: 'ya_ru' }, // Тег для фильтрации в Grafana
  });
}

// Функция для второго сценария (www.ru)
export function www_test() {
  http.get('https://www.ru', {
    tags: { my_custom_tag: 'www_ru' }, // Тег для фильтрации в Grafana
  });
}
