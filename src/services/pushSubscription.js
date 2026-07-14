  // Замени ТВОЙ_ПУБЛИЧНЫЙ_КЛЮЧ_БЕЗ_КАВЫЧЕК на реальный публичный VAPID-ключ
const VAPID_PUBLIC_KEY = 'BBR-hSeTMGfqE0t-62esbrV0TsdHBSL9DBi6nNIEU-ywRHDfLs6XyC_TPN6sMONKjI4bEhbxqXFQ3EB6cWm7tKc';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(groupId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push не поддерживается');
    return false;
  }

  let permission = Notification.permission;
  console.log('Текущее разрешение уведомлений:', permission);
  if (permission === 'denied') {
    alert('Уведомления заблокированы. Разрешите их в настройках браузера для этого сайта.');
    return false;
  }
  if (permission === 'default') {
    permission = await Notification.requestPermission();
    console.log('Запросили разрешение, результат:', permission);
    if (permission !== 'granted') return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('Создана новая push-подписка:', subscription);
    } else {
      console.log('Используем существующую подписку:', subscription);
    }

    // Отправляем подписку на сервер (прокси)
    const apiBase = import.meta.env.PROD 
    ? '/api/save-subscription' 
    : 'http://localhost:3000';

    const response = await fetch(`${apiBase}/api/save-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, subscription })
    });

    if (!response.ok) {
      console.error('Ошибка при сохранении подписки на сервере');
      return false;
    }

    console.log('Подписка успешно сохранена на сервере');
    return true;
  } catch (error) {
    console.error('Ошибка в subscribeToPush:', error);
    return false;
  }
}

export async function unsubscribeFromPush(groupId) {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    console.log('Отписка от push в браузере выполнена');
    await fetch('http://localhost:3000/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, endpoint: subscription.endpoint })
    });
    console.log('Подписка удалена на сервере');
  }
  return false; // теперь подписка не активна
}

export async function getPushSubscriptionStatus() {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}