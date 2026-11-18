# 地圖字體

來源：justfont官方open-huninn-font專案，font/jf-openhuninn-2.1.ttf（SIL Open Font License 1.1）。
https://github.com/justfont/open-huninn-font

為了讓手機開地圖不卡，本版把原本4.9MB的完整字體縮成只含網站用到的約580字（約0.2MB）。字形沒有改，只是拿掉用不到的字。
依OFL規定，修改過的字體不能再使用保留名稱「open huninn／huninn」，所以這份子集字體改名為「Fuhe Map Rounded」。授權全文保留於OFL-LICENSE.txt，來源與SHA-256見source.json。

注意：
- 若之後地圖出現新的場地或大樓名稱，而新字不在子集內，那個字會自動改用系統字體顯示（不會變成空白），但字型風格會不一致；屆時需重新產生子集。
- 原本的build-map-font.cjs會重新嵌入完整字體。若重新執行它，map-font.js會變回約6.5MB，請改用子集版字體檔。
