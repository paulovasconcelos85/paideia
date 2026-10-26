// Service worker do Paideia Ekos: só recebe notificações (não faz cache de páginas)

self.addEventListener('push', event => {
  let dados = {}
  try {
    dados = event.data ? event.data.json() : {}
  } catch {
    dados = { titulo: 'Paideia Ekos', corpo: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'Paideia Ekos', {
      body: dados.corpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: dados.url || '/financas' },
      tag: dados.tag,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/financas'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
      const aberta = janelas.find(j => 'focus' in j)
      if (aberta) {
        aberta.navigate(url)
        return aberta.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
