# α1Q v3.0 w.DRAGON Güvenlik Sistemi (FİX & STANDALONE)

Bu klasör, ATA ANS sistemindeki **α1Q v3.0 w.DRAGON** tam ekran güvenlik, geri sayım ve kilit mekanizmasını bağımsız, taşınabilir ve eksiksiz bir paket halinde sunar.

---

## 📁 Klasör İçeriği

| Dosya | Açıklama |
|---|---|
| `index.html` | Güvenlik sisteminin birebir çalışan tam ekran görsel arayüzü ve test paneli |
| `style.css` | Apple iOS tasarım dili, alev halkası, kıvılcımlar ve kilit animasyonları |
| `a1q-security.js` | WebGL Chroma-Key video işleme, Web Audio ses sentezleyici ve 4-adımlı kilit algoritması |
| `dragon.mp4` | 10 saniyelik ihlal geri sayımında uçan ejderha videosu (Yeşil perde) |
| `kilit_dragon.mp4` | Kilit ekranında arka planda süzülen ejderha videosu (Yeşil perde) |
| `kilit_bg.png` | Kilit ekranı arka plan görseli |
| `avatar.png` | Alev halkasının merkezindeki α1Q güvenlik simgesi |
| `avatar_backup.png` | Yedek avatar simgesi |
| `logo.png` | Orijinal logo görseli |

---

## 🔐 4 Adımlı Gizli Kilit Açma Dizisi

Kilit ekranı devreye girdiğinde normal bir çıkış butonu yoktur. Sistemi açmak için aşağıdaki 4 adımı sırasıyla uygulayın:

1. **Adım 1:** Kartın altındaki **"Güvenlik: α1Q v3.0 w.DRAGON"** satırına **2 kez** hızlıca tıklayın (Çift Tık).
2. **Adım 2:** Ekranın herhangi bir yerinde parmağınızı veya fareyi **aşağı doğru kaydırın** (Swipe Down).
3. **Adım 3:** Ateş auralı **Logoya (Avatar) 2 kez** çift tıklayın.
4. **Adım 4:** Ekranın tam ortasında beliren Apple tarzı **"kilidi açmak için kaydırın"** çubuğundaki yuvarlak butonu tutup **en sağa doğru sürükleyin**.

> Kilit anında açılacak ve başarı çanı (`Unlock Chime`) çalacaktır.

---

## 🚀 Başka Bir Projeye Nasıl Entegre Edilir?

1. Bu klasördeki dosyaları projenizin kök dizinine kopyalayın.
2. `index.html` sayfanıza CSS ve JS dosyalarını ekleyin:
   ```html
   <link rel="stylesheet" href="style.css">
   <!-- Sayfa sonuna: -->
   <script src="a1q-security.js"></script>
   ```
3. `index.html` dosyasındaki `countdown-overlay` ve `kurt-kapani-overlay` HTML bloklarını sayfanıza yerleştirin.
4. Güvenlik sistemini JavaScript ile dilediğiniz zaman tetikleyin:
   ```javascript
   // 10 saniyelik geri sayım ve video ile başlat:
   window.A1QSecurity.triggerCountdown();

   // Veya doğrudan tam ekran kilit ekranına geç:
   window.A1QSecurity.enterLockout();

   // Manuel kilidi aç:
   window.A1QSecurity.unlock();
   ```

---

## ⚡ Teknik Özellikler

- **GPU Donanım Hızlandırmalı WebGL Chroma-Key:** MP4 videolarındaki yeşil perde, GPU üzerinde GLSL shader kullanılarak 60 FPS hızla şeffaflaştırılır. Harici kütüphane gerektirmez.
- **Web Audio API Sentezleyici:** Geri sayım tıklamaları, C3 minör alarm akoru ve açılış çanı tarayıcının yerel ses osilatörleriyle sentezlenir (Harici .mp3/.wav dosyasına ihtiyaç duymaz).
- **Kalıcı Kilit Koruması (LocalStorage):** Kullanıcı sayfayı yenilese bile kilit durumu hafızada saklanır ve kilit ekranı otomatik olarak tekrar kilitler.
