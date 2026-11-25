/*⁠​‌​​‌​​​​‌‌​‌‌‌‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​‌‌‌​​‌​​​‌​​​​​​‌‌​​‌‌​​‌‌​‌‌‌‌​‌‌‌​​‌​​​‌​​​​​​‌​​​‌‌‌​‌​‌​​​​​​‌​​​​​‌‌‌​​‌‌​‌​‌‌​​‌‌‌​‌​​​‌​‌‌‌​​​‌‌‌​​​​​​‌‌​‌​‌‌‌​‌‌‌​​‌​‌‌​​‌​​​​‌​​‌​​​‌‌‌‌​​​‌‌‌​​​​​​‌‌​​‌​​‌‌‌‌‌​​​‌‌‌​​​​​​‌‌​​​​‌‌​‌‌‌​​​‌‌‌​​​​​​‌‌​‌​‌​‌‌​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​​‌​‌​​​​‌‌​​​‌‌​​‌​‌​​‌​​‌​​​​​​​‌‌​​‌​​​‌‌​​​​​​‌‌​​‌​​​‌‌​‌‌​​​‌​​​​​‌‌‌​​​‌‌‌​​​​​‌​‌​‌​‌​​​‌‌‌​​​‌‌‌​​​​​‌‌‌​‌​​​​​‌‌‌​​​‌‌‌​​​​​‌‌‌​​​​‌‌‌‌‌‌​​​‌‌‌​​​​​‌​‌​‌‌‌​​‌​​‌​​​​​​​‌​‌​​​​‌​​‌‌​‌​​‌​‌‌​‌​‌​​​‌​​​‌‌​​‌​‌​‌‌​​​​‌​‌‌‌​‌​​​‌‌​‌​​​​​‌​‌​​‌​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​‌‌​‌‌‌‌​‌‌‌​​‌​​‌‌​‌​​‌​‌‌​​‌‌‌​‌‌​‌​​‌​‌‌​‌‌‌​​‌‌​​​​‌​‌‌​‌‌​​​​‌​​​​​​‌‌​​​‌‌​‌‌​‌‌‌‌​‌‌​​‌​​​‌‌​​‌​‌​​‌​‌‌​​​​‌​​​​​​‌‌​​​​‌​‌‌​‌‌​​​‌‌​‌‌​​​​‌​​​​​​‌‌‌​​‌​​‌‌​‌​​‌​‌‌​​‌‌‌​‌‌​‌​​​​‌‌‌​‌​​​‌‌‌​​‌‌​​‌​​​​​​‌‌‌​​‌​​‌‌​​‌​‌​‌‌‌​​‌‌​‌‌​​‌​‌​‌‌‌​​‌​​‌‌‌​‌‌​​‌‌​​‌​‌​‌‌​​‌​​​​‌​​​​​​​‌​‌‌‌‌​​‌​​​​​​‌​​‌​​​​‌​​​‌‌​​‌​​​‌‌‌​‌​‌​​​​​​‌​‌‌​‌​‌​‌​​‌‌​‌​​‌​​‌​‌​​​‌‌‌​​‌​‌‌​‌​​‌‌​​​‌⁠ ---------- チュートリアル「羽美と走る」 (d354, まえ 2026-11-18: 羽美と走るチュートリアル。ゴーストで、体験版にこそ必要。
   説明は選択してる操作方法に合わせた内容で) ----------
   練習コース. 羽美's boat is a ghost (no contact) that always stays TUT.lead m ahead along her line — the line of the CPU
   time-attack driver at its normal pace (≈1'50"), lap 2, stored below (x, y, heading, km/h, lever, rudder, lean, pitch every
   0.1 s). While a lesson leaves a control to her, that channel follows her line (the rudder by pure pursuit, the rest from
   her recorded inputs). Each lesson pauses on a talk card (羽美's face, what to do with the 操作モード in use, OK), then the
   player drives with a one-line goal at the top; it moves on by itself when the goal is met. Hidden techniques (ウィリー,
   the swell of the last lap) are never mentioned. */
const TUT_PATH = [0.2,12.2,0.297,76.4,1.0,0.0,0.09,1.0,2.3,12.8,0.314,76.5,1.0,0.0,0.05,1.0,4.3,13.4,0.314,76.6,1.0,0.0,0.02,1.0,6.3,14.0,0.314,76.8,1.0,0.0,-0.02,1.0,8.4,14.7,0.314,76.9,1.0,0.0,-0.05,1.0,10.4,15.3,0.314,77.0,1.0,0.0,-0.08,1.0,12.5,15.9,0.314,77.2,1.0,0.0,-0.11,1.0,14.5,16.6,0.297,77.3,1.0,0.0,-0.14,1.0,16.6,17.2,0.297,77.4,1.0,0.0,-0.16,1.0,18.6,17.9,0.297,77.5,1.0,0.0,-0.19,1.0,20.7,18.5,0.297,77.6,1.0,0.0,-0.21,1.0,22.7,19.2,0.297,77.7,1.0,0.0,-0.24,1.0,24.8,19.8,0.279,77.8,1.0,0.0,-0.26,1.0,26.9,20.4,0.279,77.9,1.0,0.0,-0.28,1.0,28.9,21.0,0.279,78.0,1.0,0.0,-0.29,1.0,31.0,21.7,0.262,78.1,1.0,0.0,-0.31,1.0,33.1,22.3,0.262,78.1,1.0,0.0,-0.33,1.0,35.2,22.8,0.244,78.2,1.0,0.0,-0.34,1.0,37.3,23.4,0.244,78.3,1.0,0.0,-0.35,1.0,39.4,24.0,0.227,78.3,1.0,0.0,-0.35,1.0,41.5,24.5,0.227,78.4,1.0,0.0,-0.35,1.0,43.6,25.1,0.209,78.4,1.0,0.0,-0.35,1.0,45.7,25.6,0.209,78.5,1.0,0.0,-0.35,1.0,47.9,26.1,0.192,78.5,1.0,0.0,-0.35,1.0,50.0,26.6,0.192,78.6,1.0,0.0,-0.35,1.0,52.1,27.0,0.175,78.6,1.0,0.0,-0.35,1.0,54.3,27.5,0.175,78.6,1.0,0.0,-0.35,1.0,56.4,27.9,0.175,78.7,1.0,0.0,-0.35,1.0,58.5,28.3,0.157,78.7,1.0,0.0,-0.35,1.0,60.7,28.7,0.157,78.7,1.0,0.0,-0.35,1.0,62.9,29.1,0.14,78.8,1.0,0.0,-0.35,1.0,65.0,29.4,0.14,78.8,1.0,0.0,-0.35,1.0,67.2,29.8,0.122,78.8,1.0,0.0,-0.35,1.0,69.3,30.1,0.122,78.9,1.0,0.0,-0.35,1.0,71.5,30.4,0.105,78.9,1.0,0.0,-0.35,1.0,73.7,30.7,0.105,78.9,1.0,0.0,-0.35,1.0,75.9,31.0,0.087,78.9,1.0,0.0,-0.35,1.0,78.0,31.2,0.087,79.0,1.0,0.0,-0.35,1.0,80.2,31.4,0.07,79.0,1.0,0.0,-0.35,1.0,82.4,31.6,0.07,79.0,1.0,0.0,-0.35,1.0,84.6,31.8,0.052,79.0,1.0,0.0,-0.35,1.0,86.8,32.0,0.052,79.1,1.0,0.0,-0.35,1.0,89.0,32.2,0.035,79.1,1.0,0.0,-0.35,1.0,91.2,32.3,0.035,79.1,1.0,0.0,-0.35,1.0,93.4,32.4,0.017,79.1,1.0,0.0,-0.35,1.0,95.6,32.5,0.017,79.1,1.0,0.0,-0.35,1.0,97.8,32.6,0.0,79.2,1.0,0.0,-0.34,1.0,100.0,32.7,0.0,79.2,1.0,0.0,-0.33,1.0,102.2,32.7,-0.017,79.2,1.0,0.0,-0.32,1.0,104.4,32.8,-0.017,79.2,1.0,0.0,-0.3,1.0,106.6,32.8,-0.017,79.2,1.0,0.0,-0.29,1.0,108.8,32.8,-0.035,79.2,1.0,0.0,-0.27,1.0,111.0,32.7,-0.035,79.3,1.0,0.0,-0.26,1.0,113.2,32.7,-0.052,79.3,1.0,0.0,-0.24,1.0,115.4,32.6,-0.052,79.3,1.0,0.0,-0.23,1.0,117.6,32.6,-0.052,79.3,1.0,0.0,-0.21,1.0,119.8,32.5,-0.07,79.3,1.0,0.0,-0.2,1.0,122.0,32.4,-0.07,79.4,1.0,0.0,-0.18,1.0,124.2,32.3,-0.07,79.2,1.0,-1.0,-1.0,0.0,126.4,32.1,-0.105,78.7,1.0,-1.0,-1.0,0.0,128.5,32.0,-0.157,78.0,1.0,-1.0,-1.0,0.0,130.7,31.8,-0.209,77.0,1.0,-1.0,-1.0,0.0,132.8,31.5,-0.262,76.0,1.0,-1.0,-1.0,0.0,134.9,31.2,-0.332,74.8,1.0,-1.0,-1.0,0.0,136.9,30.8,-0.401,73.6,1.0,-1.0,-1.0,0.0,138.9,30.2,-0.471,72.3,1.0,-1.0,-1.0,0.0,140.8,29.6,-0.541,71.0,1.0,-1.0,-1.0,0.0,142.7,28.9,-0.611,69.7,1.0,-1.0,-1.0,0.0,144.5,28.0,-0.681,68.4,1.0,-1.0,-1.0,0.0,146.1,27.1,-0.75,67.1,1.0,-1.0,-1.0,0.0,147.7,26.1,-0.838,65.8,1.0,-1.0,-1.0,0.0,149.2,24.9,-0.908,64.6,1.0,-1.0,-1.0,0.0,150.6,23.7,-0.995,63.4,1.0,-1.0,-1.0,0.0,151.8,22.4,-1.065,62.1,1.0,-1.0,-1.0,0.0,152.9,21.1,-1.152,60.9,1.0,-1.0,-1.0,0.0,153.9,19.7,-1.239,59.7,1.0,-1.0,-1.0,0.0,154.8,18.2,-1.326,58.5,1.0,-1.0,-1.0,0.0,155.5,16.8,-1.414,57.3,1.0,-1.0,-1.0,0.0,156.1,15.2,-1.501,56.0,1.0,-1.0,-1.0,0.0,156.6,13.7,-1.588,54.8,1.0,-1.0,-1.0,0.0,156.9,12.2,-1.676,53.6,1.0,-1.0,-1.0,0.0,157.1,10.7,-1.78,52.3,1.0,-1.0,-1.0,0.0,157.1,9.2,-1.868,51.0,1.0,-1.0,-1.0,0.0,157.0,7.7,-1.972,49.8,1.0,-1.0,-1.0,0.0,156.8,6.3,-2.077,48.4,1.0,-1.0,-1.0,0.0,156.4,5.0,-2.182,47.1,1.0,-1.0,-1.0,0.0,156.0,3.7,-2.286,45.8,1.0,-1.0,-1.0,0.0,155.4,2.5,-2.391,44.4,1.0,-1.0,-1.0,0.0,154.7,1.4,-2.513,43.0,1.0,-1.0,-1.0,0.0,154.0,0.5,-2.618,41.6,1.0,-1.0,-1.0,0.0,153.1,-0.4,-2.74,40.1,1.0,-1.0,-1.0,0.0,152.3,-1.1,-2.862,38.7,1.0,-1.0,-1.0,0.0,151.3,-1.8,-2.985,37.2,1.0,-0.83,-0.87,0.08,150.3,-2.2,-3.107,35.8,1.0,-0.67,-0.76,0.17,149.4,-2.6,3.054,34.7,1.0,-0.5,-0.65,0.25,148.4,-2.8,2.967,34.0,1.0,-0.33,-0.54,0.33,147.4,-3.0,2.897,33.7,1.0,-0.17,-0.45,0.42,146.4,-3.0,2.845,33.8,1.0,0.0,-0.36,0.5,145.4,-3.0,2.827,34.4,1.0,0.0,-0.28,0.58,144.4,-2.9,2.81,35.1,1.0,0.0,-0.21,0.67,143.4,-2.8,2.793,36.1,1.0,0.0,-0.15,0.75,142.4,-2.6,2.793,37.1,1.0,0.0,-0.09,0.83,141.4,-2.3,2.793,38.1,1.0,0.0,-0.04,0.92,140.3,-2.0,2.793,39.1,1.0,0.0,0.0,1.0,139.3,-1.7,2.81,40.1,1.0,0.0,0.35,1.0,138.2,-1.5,3.019,35.2,1.0,0.0,0.35,1.0,137.2,-1.6,3.037,36.3,1.0,0.0,0.35,1.0,136.2,-1.6,3.054,37.2,1.0,0.0,0.35,1.0,135.2,-1.5,3.054,38.2,1.0,0.0,0.35,1.0,134.1,-1.5,3.072,39.2,1.0,0.0,0.35,1.0,133.0,-1.4,3.089,40.1,1.0,0.0,0.35,1.0,131.9,-1.4,3.089,41.0,1.0,0.0,0.35,1.0,130.7,-1.3,3.107,42.0,1.0,0.0,0.35,1.0,129.5,-1.3,3.124,42.8,1.0,0.0,0.35,1.0,128.3,-1.2,3.124,43.7,1.0,0.0,0.35,1.0,127.1,-1.2,3.142,44.6,1.0,0.0,0.35,1.0,125.9,-1.1,-3.142,45.4,1.0,0.0,0.35,1.0,124.6,-1.1,-3.124,46.2,1.0,0.0,0.35,1.0,123.3,-1.1,-3.124,47.1,1.0,0.0,0.35,1.0,122.0,-1.1,-3.107,47.9,1.0,0.0,0.35,1.0,120.6,-1.1,-3.107,48.7,1.0,0.0,0.35,1.0,119.3,-1.1,-3.089,49.5,1.0,0.0,0.35,1.0,117.9,-1.2,-3.089,50.2,1.0,0.0,0.35,1.0,116.5,-1.2,-3.072,51.0,1.0,0.0,0.35,1.0,115.0,-1.3,-3.072,51.8,1.0,0.0,0.35,1.0,113.6,-1.4,-3.054,52.5,1.0,0.0,0.35,1.0,112.1,-1.4,-3.054,53.2,1.0,0.0,0.35,1.0,110.6,-1.5,-3.037,54.0,1.0,0.0,0.35,1.0,109.1,-1.7,-3.037,54.7,1.0,0.0,0.35,1.0,107.6,-1.8,-3.019,55.3,1.0,0.0,0.35,1.0,106.1,-1.9,-3.019,56.0,1.0,0.0,0.35,1.0,104.5,-2.1,-3.002,56.7,1.0,0.0,0.35,1.0,102.9,-2.3,-3.002,57.3,1.0,0.0,0.35,1.0,101.3,-2.5,-2.985,58.0,1.0,0.0,0.35,1.0,99.7,-2.7,-2.985,58.6,1.0,0.0,0.35,1.0,98.1,-2.9,-2.967,59.2,1.0,0.0,0.35,1.0,96.5,-3.1,-2.967,59.8,1.0,0.0,0.35,1.0,94.8,-3.4,-2.95,60.4,1.0,0.0,0.35,1.0,93.2,-3.6,-2.95,61.0,1.0,0.0,0.35,1.0,91.5,-3.9,-2.95,61.6,1.0,0.0,0.35,1.0,89.8,-4.2,-2.932,62.1,1.0,0.0,0.35,1.0,88.1,-4.6,-2.932,62.7,1.0,0.0,0.35,1.0,86.4,-4.9,-2.915,63.2,1.0,0.0,0.35,1.0,84.6,-5.2,-2.915,63.7,1.0,0.0,0.32,1.0,82.9,-5.6,-2.897,64.2,1.0,0.0,0.29,1.0,81.1,-6.0,-2.897,64.7,1.0,0.0,0.25,1.0,79.4,-6.4,-2.88,65.2,1.0,0.0,0.22,1.0,77.6,-6.8,-2.88,65.7,1.0,0.0,0.19,1.0,75.8,-7.3,-2.88,66.2,1.0,0.0,0.15,1.0,74.0,-7.7,-2.862,66.6,1.0,0.0,0.12,1.0,72.3,-8.2,-2.862,67.1,1.0,0.0,0.09,1.0,70.4,-8.7,-2.862,67.5,1.0,0.0,0.06,1.0,68.6,-9.2,-2.862,67.9,1.0,0.0,0.03,1.0,66.8,-9.7,-2.862,68.4,1.0,0.0,0.0,1.0,65.0,-10.2,-2.862,68.8,1.0,0.0,-0.02,1.0,63.1,-10.7,-2.862,69.2,1.0,0.0,-0.05,1.0,61.3,-11.3,-2.862,69.6,1.0,0.0,-0.07,1.0,59.4,-11.8,-2.862,70.0,1.0,0.0,-0.1,1.0,57.5,-12.3,-2.862,70.3,1.0,0.0,-0.12,1.0,55.7,-12.9,-2.862,70.7,1.0,0.0,-0.14,1.0,53.8,-13.4,-2.862,71.0,1.0,0.0,-0.16,1.0,51.9,-13.9,-2.88,71.4,1.0,0.0,-0.18,1.0,49.9,-14.5,-2.88,71.7,1.0,0.0,-0.2,1.0,48.0,-15.0,-2.88,72.0,1.0,0.0,-0.22,1.0,46.1,-15.5,-2.88,72.3,1.0,0.0,-0.24,1.0,44.1,-16.1,-2.897,72.6,1.0,0.0,-0.25,1.0,42.2,-16.6,-2.897,72.8,1.0,0.0,-0.27,1.0,40.2,-17.1,-2.897,73.1,1.0,0.0,-0.28,1.0,38.3,-17.6,-2.915,73.3,1.0,0.0,-0.29,1.0,36.3,-18.1,-2.915,73.6,1.0,0.0,-0.3,1.0,34.3,-18.6,-2.932,73.8,1.0,0.0,-0.31,1.0,32.3,-19.1,-2.932,74.0,1.0,0.0,-0.32,1.0,30.3,-19.5,-2.932,74.2,1.0,0.0,-0.33,1.0,28.3,-20.0,-2.95,74.4,1.0,0.0,-0.34,1.0,26.3,-20.4,-2.95,74.6,1.0,0.0,-0.34,1.0,24.2,-20.9,-2.967,74.8,1.0,0.0,-0.35,1.0,22.2,-21.3,-2.967,75.0,1.0,0.0,-0.35,1.0,20.1,-21.7,-2.985,75.1,1.0,0.0,-0.35,1.0,18.1,-22.1,-2.985,75.3,1.0,0.0,-0.35,1.0,16.0,-22.4,-3.002,75.4,1.0,0.0,-0.35,1.0,13.9,-22.8,-3.002,75.6,1.0,0.0,-0.35,1.0,11.9,-23.1,-3.019,75.7,1.0,0.0,-0.35,1.0,9.8,-23.4,-3.019,75.9,1.0,0.0,-0.35,1.0,7.7,-23.7,-3.037,76.0,1.0,0.0,-0.35,1.0,5.6,-24.0,-3.037,76.1,1.0,0.0,-0.35,1.0,3.5,-24.3,-3.054,76.3,1.0,0.0,-0.35,1.0,1.4,-24.5,-3.054,76.4,1.0,0.0,-0.35,1.0,-0.7,-24.7,-3.072,76.5,1.0,0.0,-0.34,1.0,-2.8,-24.9,-3.072,76.6,1.0,0.0,-0.33,1.0,-5.0,-25.1,-3.089,76.7,1.0,0.0,-0.33,1.0,-7.1,-25.3,-3.089,76.8,1.0,0.0,-0.32,1.0,-9.2,-25.5,-3.089,76.9,1.0,0.0,-0.31,1.0,-11.3,-25.6,-3.107,77.0,1.0,0.0,-0.3,1.0,-13.5,-25.7,-3.107,77.1,1.0,0.0,-0.3,1.0,-15.4,-25.8,-3.124,77.2,1.0,0.0,-0.29,1.0,-17.6,-25.9,-3.124,77.3,1.0,0.0,-0.28,1.0,-19.7,-26.0,-3.142,77.4,1.0,0.0,-0.27,1.0,-21.9,-26.1,-3.142,77.5,1.0,0.0,-0.26,1.0,-24.0,-26.1,3.142,77.6,1.0,0.0,-0.25,1.0,-26.2,-26.2,3.124,77.7,1.0,0.0,-0.24,1.0,-28.4,-26.2,3.124,77.7,1.0,0.0,-0.23,1.0,-30.5,-26.2,3.124,77.8,1.0,0.0,-0.22,1.0,-32.7,-26.2,3.107,77.9,1.0,0.0,-0.2,1.0,-34.8,-26.1,3.107,78.0,1.0,0.0,-0.19,1.0,-37.0,-26.1,3.107,78.0,1.0,0.0,-0.18,1.0,-39.2,-26.1,3.107,78.1,1.0,0.0,-0.17,1.0,-41.4,-26.0,3.089,78.2,1.0,0.0,-0.16,1.0,-43.5,-25.9,3.089,78.3,1.0,0.0,-0.15,1.0,-45.7,-25.9,3.089,78.3,1.0,0.0,-0.13,1.0,-47.9,-25.8,3.089,78.4,1.0,0.0,-0.12,1.0,-50.1,-25.7,3.089,78.4,1.0,0.0,-0.11,1.0,-52.2,-25.6,3.072,78.5,1.0,0.0,-0.1,1.0,-54.4,-25.4,3.072,78.6,1.0,0.0,-0.09,1.0,-56.6,-25.3,3.072,78.6,1.0,0.0,-0.08,1.0,-58.8,-25.2,3.072,78.7,1.0,0.0,-0.07,1.0,-61.0,-25.0,3.072,78.7,1.0,0.0,-0.06,1.0,-63.1,-24.9,3.072,78.8,1.0,0.0,-0.05,1.0,-65.3,-24.7,3.072,78.8,1.0,0.0,-0.04,1.0,-67.5,-24.6,3.072,78.9,1.0,0.0,-0.03,1.0,-69.7,-24.4,3.072,78.9,1.0,0.0,-0.02,1.0,-71.9,-24.3,3.072,79.0,1.0,0.0,-0.01,1.0,-74.1,-24.1,3.072,79.0,1.0,0.0,0.0,1.0,-76.3,-24.0,3.072,79.1,1.0,0.0,0.01,1.0,-78.4,-23.8,3.072,79.1,1.0,0.0,0.02,1.0,-80.6,-23.6,3.072,79.2,1.0,0.0,0.02,1.0,-82.8,-23.4,3.072,79.2,1.0,0.0,0.03,1.0,-85.0,-23.3,3.072,79.2,1.0,0.0,0.04,1.0,-87.2,-23.1,3.072,79.3,1.0,0.0,0.05,1.0,-89.4,-22.9,3.072,79.3,1.0,0.0,0.05,1.0,-91.6,-22.8,3.072,79.3,1.0,0.0,0.06,1.0,-93.8,-22.6,3.072,79.4,1.0,0.0,0.06,1.0,-96.0,-22.4,3.072,79.4,1.0,0.0,0.07,1.0,-98.2,-22.3,3.072,79.4,1.0,0.0,0.08,1.0,-100.4,-22.1,3.072,79.5,1.0,0.0,0.08,1.0,-102.6,-22.0,3.072,79.5,1.0,0.0,0.08,1.0,-104.8,-21.8,3.072,79.5,1.0,0.0,0.09,1.0,-107.0,-21.6,3.072,79.5,1.0,0.0,0.09,1.0,-109.2,-21.5,3.089,79.6,1.0,0.0,0.09,1.0,-111.4,-21.4,3.089,79.6,1.0,0.0,0.1,1.0,-113.6,-21.2,3.089,79.6,1.0,0.0,0.1,1.0,-115.8,-21.1,3.089,79.6,1.0,0.0,0.1,1.0,-118.1,-21.0,3.089,79.6,1.0,-1.0,-1.0,0.0,-120.3,-20.8,3.072,79.2,1.0,-1.0,-1.0,0.0,-122.4,-20.7,3.037,78.6,1.0,-1.0,-1.0,0.0,-124.6,-20.5,2.985,77.8,1.0,-1.0,-1.0,0.0,-126.8,-20.3,2.932,76.8,1.0,-1.0,-1.0,0.0,-128.9,-20.1,2.862,75.7,1.0,-1.0,-1.0,0.0,-130.9,-19.7,2.81,74.4,1.0,-1.0,-1.0,0.0,-133.0,-19.3,2.74,73.2,1.0,-1.0,-1.0,0.0,-134.9,-18.8,2.67,71.9,1.0,-1.0,-1.0,0.0,-136.8,-18.1,2.601,70.5,1.0,-1.0,-1.0,0.0,-138.7,-17.4,2.531,69.2,1.0,-1.0,-1.0,0.0,-140.4,-16.5,2.443,67.9,1.0,-1.0,-1.0,0.0,-142.1,-15.6,2.374,66.6,1.0,-1.0,-1.0,0.0,-143.6,-14.5,2.304,65.4,1.0,-1.0,-1.0,0.0,-145.1,-13.4,2.217,64.1,1.0,-1.0,-1.0,0.0,-146.4,-12.2,2.147,62.9,1.0,-1.0,-1.0,0.0,-147.7,-10.9,2.059,61.7,1.0,-1.0,-1.0,0.0,-148.8,-9.6,1.99,60.5,1.0,-1.0,-1.0,0.0,-149.8,-8.2,1.902,59.3,1.0,-1.0,-1.0,0.0,-150.6,-6.7,1.815,58.1,1.0,-1.0,-1.0,0.0,-151.3,-5.3,1.728,56.9,1.0,-1.0,-1.0,0.0,-151.9,-3.8,1.641,55.7,1.0,-1.0,-1.0,0.0,-152.4,-2.2,1.553,54.4,1.0,-1.0,-1.0,0.0,-152.7,-0.7,1.449,53.2,1.0,-1.0,-1.0,0.0,-152.8,0.8,1.361,52.0,1.0,-1.0,-1.0,0.0,-152.9,2.3,1.274,50.7,1.0,-1.0,-1.0,0.0,-152.8,3.7,1.169,49.5,1.0,-1.0,-1.0,0.0,-152.6,5.1,1.065,48.2,1.0,-1.0,-1.0,0.0,-152.2,6.4,0.96,46.9,1.0,-1.0,-1.0,0.0,-151.8,7.7,0.855,45.5,1.0,-1.0,-1.0,0.0,-151.2,8.9,0.75,44.2,1.0,-1.0,-1.0,0.0,-150.5,10.0,0.646,42.8,1.0,-1.0,-1.0,0.0,-149.8,10.9,0.524,41.4,1.0,-1.0,-1.0,0.0,-148.9,11.8,0.401,40.0,1.0,-1.0,-1.0,0.0,-148.1,12.5,0.279,38.5,1.0,-1.0,-1.0,0.0,-147.1,13.2,0.157,37.1,1.0,-0.83,-0.87,0.08,-146.2,13.6,0.035,35.7,1.0,-0.67,-0.76,0.17,-145.2,14.0,-0.087,34.6,1.0,-0.5,-0.65,0.25,-144.2,14.3,-0.175,33.8,1.0,-0.33,-0.54,0.33,-143.2,14.4,-0.244,33.5,1.0,-0.17,-0.45,0.42,-142.2,14.5,-0.297,33.6,1.0,0.0,-0.36,0.5,-141.2,14.4,-0.314,34.2,1.0,0.0,-0.28,0.58,-140.3,14.4,-0.332,35.0,1.0,0.0,-0.21,0.67,-139.3,14.2,-0.332,35.9,1.0,0.0,-0.15,0.75,-138.3,14.0,-0.349,36.9,1.0,0.0,-0.09,0.83,-137.2,13.8,-0.349,37.9,1.0,0.0,-0.04,0.92,-136.2,13.5,-0.332,38.9,1.0,0.0,0.0,1.0,-135.2,13.2,-0.332,39.9,1.0,0.0,0.35,1.0,-134.1,12.8,-0.332,40.8,1.0,0.0,0.35,1.0,-133.0,12.5,-0.314,41.7,1.0,0.0,0.35,1.0,-131.9,12.1,-0.314,42.6,1.0,0.0,0.35,1.0,-130.7,11.8,-0.297,43.5,1.0,0.0,0.35,1.0,-129.6,11.4,-0.297,44.4,1.0,0.0,0.35,1.0,-128.4,11.0,-0.279,45.2,1.0,0.0,0.35,1.0,-127.2,10.6,-0.279,46.0,1.0,0.0,0.35,1.0,-125.9,10.3,-0.262,46.9,1.0,0.0,0.35,1.0,-124.7,9.9,-0.262,47.7,1.0,0.0,0.35,1.0,-123.4,9.5,-0.244,48.5,1.0,0.0,0.35,1.0,-122.1,9.2,-0.244,49.3,1.0,0.0,0.35,1.0,-120.7,8.8,-0.227,50.0,1.0,0.0,0.35,1.0,-119.4,8.5,-0.227,50.8,1.0,0.0,0.35,1.0,-118.0,8.1,-0.209,51.6,1.0,0.0,0.35,1.0,-116.6,7.8,-0.209,52.3,1.0,0.0,0.35,1.0,-115.2,7.5,-0.192,53.0,1.0,0.0,0.35,1.0,-113.7,7.1,-0.192,53.8,1.0,0.0,0.35,1.0,-112.3,6.8,-0.175,54.5,1.0,0.0,0.35,1.0,-110.8,6.5,-0.175,55.2,1.0,0.0,0.35,1.0,-109.2,6.2,-0.157,55.8,1.0,0.0,0.35,1.0,-107.7,5.9,-0.157,56.5,1.0,0.0,0.35,1.0,-106.2,5.7,-0.14,57.2,1.0,0.0,0.35,1.0,-104.6,5.4,-0.14,57.8,1.0,0.0,0.35,1.0,-103.0,5.1,-0.122,58.4,1.0,0.0,0.35,1.0,-101.4,4.9,-0.122,59.0,1.0,0.0,0.35,1.0,-99.7,4.7,-0.105,59.6,1.0,0.0,0.35,1.0,-98.1,4.4,-0.105,60.2,1.0,0.0,0.35,1.0,-96.4,4.2,-0.087,60.8,1.0,0.0,0.35,1.0,-94.7,4.0,-0.087,61.4,1.0,0.0,0.35,1.0,-93.0,3.9,-0.07,61.9,1.0,0.0,0.35,1.0,-91.3,3.7,-0.07,62.5,1.0,0.0,0.35,1.0,-89.6,3.5,-0.052,63.0,1.0,0.0,0.35,1.0,-87.8,3.4,-0.052,63.5,1.0,0.0,0.35,1.0,-86.1,3.2,-0.035,64.0,1.0,0.0,0.35,1.0,-84.3,3.1,-0.035,64.5,1.0,0.0,0.35,1.0,-82.5,3.0,-0.017,65.0,1.0,0.0,0.35,1.0,-80.7,2.9,-0.017,65.4,1.0,0.0,0.35,1.0,-78.8,2.9,-0.017,65.9,1.0,0.0,0.35,1.0,-77.0,2.8,0.0,66.3,1.0,0.0,0.35,1.0,-75.2,2.8,0.0,66.8,1.0,0.0,0.35,1.0,-73.3,2.7,0.017,67.2,1.0,0.0,0.35,1.0,-71.4,2.7,0.017,67.6,1.0,0.0,0.35,1.0,-69.5,2.7,0.035,68.0,1.0,0.0,0.35,1.0,-67.6,2.7,0.035,68.4,1.0,0.0,0.35,1.0,-65.7,2.8,0.052,68.7,1.0,0.0,0.35,1.0,-63.8,2.8,0.052,69.1,1.0,0.0,0.35,1.0,-61.9,2.9,0.07,69.4,1.0,0.0,0.35,1.0,-60.0,3.0,0.07,69.8,1.0,0.0,0.35,1.0,-58.0,3.1,0.087,70.1,1.0,0.0,0.35,1.0,-56.1,3.2,0.087,70.4,1.0,0.0,0.35,1.0,-54.1,3.3,0.105,70.7,1.0,0.0,0.35,1.0,-52.2,3.5,0.105,71.0,1.0,0.0,0.35,1.0,-50.2,3.7,0.122,71.3,1.0,0.0,0.35,1.0,-48.2,3.9,0.122,71.6,1.0,0.0,0.35,1.0,-46.2,4.1,0.14,71.9,1.0,0.0,0.35,1.0,-44.2,4.3,0.14,72.2,1.0,0.0,0.35,1.0,-42.2,4.5,0.157,72.4,1.0,0.0,0.35,1.0,-40.2,4.8,0.157,72.7,1.0,0.0,0.35,1.0,-38.2,5.1,0.175,72.9,1.0,0.0,0.35,1.0,-36.2,5.3,0.175,73.1,1.0,0.0,0.35,1.0,-34.2,5.7,0.192,73.4,1.0,0.0,0.35,1.0,-32.2,6.0,0.192,73.6,1.0,0.0,0.35,1.0,-30.2,6.3,0.209,73.8,1.0,0.0,0.35,1.0,-28.2,6.7,0.209,74.0,1.0,0.0,0.35,1.0,-26.1,7.1,0.227,74.2,1.0,0.0,0.35,1.0,-24.1,7.5,0.227,74.4,1.0,0.0,0.35,1.0,-22.1,7.9,0.244,74.5,1.0,0.0,0.35,1.0,-20.1,8.3,0.244,74.7,1.0,0.0,0.35,1.0,-18.0,8.8,0.244,74.9,1.0,0.0,0.35,1.0,-16.0,9.3,0.262,75.1,1.0,0.0,0.32,1.0,-14.0,9.8,0.262,75.2,1.0,0.0,0.28,1.0,-11.9,10.3,0.279,75.4,1.0,0.0,0.24,1.0,-9.9,10.8,0.279,75.5,1.0,0.0,0.2,1.0,-7.9,11.3,0.297,75.7,1.0,0.0,0.16,1.0,-5.9,11.9,0.297,75.8,1.0,0.0,0.12,1.0,-3.8,12.5,0.297,75.9,1.0,0.0,0.09,1.0,-1.8,13.1,0.297,76.1,1.0,0.0,0.05,1.0];
const TUT = { on: false, lead: 15, look: 9, step: -1, phase: '', t: 0, idx: 0, lap: 0, S: 0, goal: 0, hold: 0, turn: null, capT: 0, said: '', venue0: null, offT: 0 };
const TUT_SMOOTH = 12;
const TP = (() => { const n = TUT_PATH.length / 8, p = []; let s = 0;
  // her TA line passes 2–3 m off the mark; for learners it is eased outward near the marks (below, ≥ 6 m)
  const X = [], Y = [];
  for (let i = 0; i < n; i++) { let x = TUT_PATH[i * 8], y = TUT_PATH[i * 8 + 1]; const mx = Math.sign(x) * MK, d = Math.hypot(x - mx, y);
    X.push(x); Y.push(y); }
  // d385 (まえ: チュートリアルの羽美のゴーストががたがた): the recorded points (0.1 m steps, ~1.9 m apart, a kink at the lap seam)
  // made a polyline — her boat changed direction in jerks at every point. Smooth them round the loop (TUT_SMOOTH passes of 1-2-1)
  for (let k = 0; k < TUT_SMOOTH; k++) for (const A of [X, Y]) { const c = A.slice(); for (let i = 0; i < n; i++) A[i] = (c[(i + n - 1) % n] + 2 * c[i] + c[(i + 1) % n]) / 4; }
  const X0 = X.slice(), Y0 = Y.slice();   // d386: the smoothed line before the easing (to scale her recorded rudder below)
  // then the easing near the marks (d385: d → d + (14 − d)²/24 inside 14 m — ≥ 6 m from the mark, and no bend in the line where it starts)
  for (let i = 0; i < n; i++) { const mx = Math.sign(X[i]) * MK, d = Math.hypot(X[i] - mx, Y[i]);
    if (d < 14) { const f = (d + (14 - d) ** 2 / 24) / Math.max(d, 0.01); X[i] = mx + (X[i] - mx) * f; Y[i] *= f; } }
  // d386 (まえ: 操作が戻った瞬間に消波装置にぶつかる): out of 1M her TA line ran 1.3 m beside the boom (a ghost goes through it) —
  // keep it off the boom the same way (d → d + (8 − d)²/13 inside 8 m of it: ≥ 4.5 m; carried 14 m past its inner end so she doesn't swing back in at the tip)
  for (let i = 0; i < n; i++) { const sx = Math.sign(X[i]), ax = Math.abs(X[i]), cx = Math.min(Math.max(ax, MK - 2 - BOOM_LEN - 14), MK - 2), d = Math.hypot(ax - cx, Y[i]);
    if (d < 8 && d > 0.01) { const f = (d + (8 - d) ** 2 / 13) / d; X[i] = sx * (cx + (ax - cx) * f); Y[i] *= f; } }
  for (let k = 0; k < 3; k++) for (const A of [X, Y]) { const c = A.slice(); for (let i = 0; i < n; i++) A[i] = (c[(i + n - 1) % n] + 2 * c[i] + c[(i + 1) % n]) / 4; }
  // d386: her recorded rudder bent her own line; where the easing straightened or widened it, the same rudder pulled the boat inside
  // (toward the boom). Scale it by how much the line still bends there (curvature after / before, 0…1.5)
  const kap = (A, B, i) => { const a = (i + n - 3) % n, b = (i + n + 3) % n, h1 = Math.atan2(B[i] - B[a], A[i] - A[a]), h2 = Math.atan2(B[b] - B[i], A[b] - A[i]);
    let dh = h2 - h1; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); return dh / (Math.hypot(A[i] - A[a], B[i] - B[a]) + Math.hypot(A[b] - A[i], B[b] - B[i]) || 1); };
  const FF = []; for (let i = 0; i < n; i++) { const k0 = kap(X0, Y0, i), k1 = kap(X, Y, i); FF.push(Math.abs(k0) < 0.004 ? 1 : k0 * k1 <= 0 ? 0 : Math.min(1.5, k1 / k0)); }
  for (let i = 0; i < n; i++) { const j = i * 8; if (i) s += Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
    p.push({ x: X[i], y: Y[i], a: TUT_PATH[j + 2], v: TUT_PATH[j + 3] / 3.6, thr: TUT_PATH[j + 4], steer: TUT_PATH[j + 5] * FF[i], roll: TUT_PATH[j + 6], pitch: TUT_PATH[j + 7], s }); }
  const L = s + Math.hypot(p[0].x - p[n - 1].x, p[0].y - p[n - 1].y);
  // d385: re-sample at even spacing (the 0.1 s points were closer in the turns), so the Catmull-Rom in tutAt runs at an even pace
  const q = [], K = ['x', 'y', 'v', 'thr', 'steer', 'roll', 'pitch'];
  for (let i = 0, j = 0; i < n; i++) { const si = i * L / n; while (j < n - 1 && p[j + 1].s <= si) j++;
    const a = p[j], b = j < n - 1 ? p[j + 1] : p[0], sb = j < n - 1 ? b.s : L, f = (si - a.s) / ((sb - a.s) || 1), o = { s: si, a: 0 };
    for (const k of K) o[k] = a[k] + (b[k] - a[k]) * f; q.push(o); }
  p.length = 0; p.push(...q);
  for (let i = 0; i < n; i++) { const a = p[(i + n - 1) % n], b = p[(i + 1) % n]; p[i].a = Math.atan2(b.y - a.y, b.x - a.x); }   // heading from the eased path (d385: round the loop)
  return { p, n, L }; })();
// the point of her line at distance S (laps wrap)
function tutAt(S) {
  const { p, n, L } = TP; let s = ((S % L) + L) % L, lo = 0, hi = n - 1;
  let f;
  if (s >= p[n - 1].s) { lo = n - 1; hi = 0; f = (s - p[lo].s) / (L - p[lo].s); }
  else { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].s <= s) lo = m; else hi = m; } f = (s - p[lo].s) / ((p[hi].s - p[lo].s) || 1); }
  const r = tutLerp(p[lo], p[hi], f), a = p[(lo + n - 1) % n], b = p[lo], c = p[hi], d = p[(hi + 1) % n];
  // d385: Catmull-Rom between the points, so the position (and its direction) has no corners
  const f2 = f * f, f3 = f2 * f, cr = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (3 * p1 - p0 - 3 * p2 + p3) * f3);
  r.x = cr(a.x, b.x, c.x, d.x); r.y = cr(a.y, b.y, c.y, d.y);
  return r;
}
function tutLerp(a, b, f) { let da = b.a - a.a; da = Math.atan2(Math.sin(da), Math.cos(da));
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, a: a.a + da * f, v: a.v + (b.v - a.v) * f, thr: a.thr + (b.thr - a.thr) * f, steer: a.steer + (b.steer - a.steer) * f, roll: a.roll + (b.roll - a.roll) * f, pitch: a.pitch + (b.pitch - a.pitch) * f }; }
// where the player is along her line: the nearest point a little around the last one (monotonic, wraps into the next lap)
function tutMatch(b) {
  const { p, n } = TP; let best = TUT.idx, bd = 1e9;
  for (let k = -15; k <= 60; k++) { const i = (TUT.idx + k + n) % n, d = (p[i].x - b.x) ** 2 + (p[i].y - b.y) ** 2; if (d < bd) { bd = d; best = i; } }
  if (best < TUT.idx - n / 2) TUT.lap++; else if (best > TUT.idx + n / 2) TUT.lap--;
  // d365: the point between the nearest path points (the path points are ~2 m apart; snapping to them made her jump)
  const a = p[best], c = p[(best + 1) % n], sx = c.x - a.x, sy = c.y - a.y, sl2 = sx * sx + sy * sy || 1;
  const f = clamp(((b.x - a.x) * sx + (b.y - a.y) * sy) / sl2, -1, 1), segL = best + 1 < n ? c.s - a.s : TP.L - a.s;
  TUT.idx = best; TUT.S = TUT.lap * TP.L + a.s + f * segL; TUT.off = Math.sqrt(bd);
}
// d365 (まえ: チュートリアルの羽美の動きがガクガク): her place runs smoothly at the player's speed, eased toward
// 「lead m ahead of the player」 — it used to be pinned to the player's position, so every wobble of the player moved her
function tutGhostRun(dt) {
  const tgt = TUT.S + TUT.lead;
  if (TUT.gS == null || Math.abs(tgt - TUT.gS) > 25) { TUT.gS = tgt; TUT.gV = Math.max(0, B.v); }
  // d385: her speed follows the player's through a short lag (the player's speed jumps when put back on the line, or bobs)
  const want = Math.max(0, Math.max(0, B.v) + 0.8 * (tgt - TUT.gS));
  TUT.gV = (TUT.gV ?? want) + (want - (TUT.gV ?? want)) * (1 - Math.exp(-dt * 5));
  TUT.gS += TUT.gV * dt;
}
function tutGhostPose() {
  const gS = TUT.gS != null ? TUT.gS : TUT.S + TUT.lead, g = tutAt(gS), nx = tutAt(gS + 0.6);
  const gb = { x: g.x, y: g.y, a: g.a, v: g.v, vl: 0, yaw: 0, porp: 0, cap: 0, load: 0 };
  const dx = nx.x - g.x, dy = nx.y - g.y, fx = Math.cos(g.a), fy = Math.sin(g.a);
  gb.slip = Math.atan2(-fy * dx + fx * dy, Math.max(0.05, fx * dx + fy * dy));
  return gb;
}
const tutGhostOn = () => TUT.on && TUT.phase === 'run' && TUT.step >= 0 && TUT.step < 5 && !fleet;
function tutGhosts() { return tutGhostOn() ? [{ b: tutGhostPose(), kind: 'umi' }] : []; }
const UMI_STYLE = { hull: '#3fbf7f', num: '#0b2a1c', label: '6', helmet: '#3fbf7f' };
function tutDrawGhost() { if (!tutGhostOn()) return; ctx.save(); ctx.globalAlpha = 0.5; drawBoatAt(tutGhostPose(), GHOST_IN, UMI_STYLE, false); ctx.restore(); }

// ---- what to do, in the words of the 操作モード in use ----
function tutHow(ch) {
  const m = controlMode, rt = typeof pad !== 'undefined' && pad.useRT ? '右' : '左';
  const pos = typeof thrPosNow === 'function' ? thrPosNow() : 'left';
  const lever = pos === 'right' ? '舵のとなりのレバー' : pos === 'center' ? '真ん中のレバー' : '左手の指';
  const H = {
    thr: { tilt: `${lever}を上へ動かすと握る、下へ動かすと緩める。指を離しても、その位置で止まるよ。`, pad: `${lever}を上へ動かすと握る、下へ動かすと緩める。指を離しても、その位置で止まるよ。`,
      fuse: '左手の指を上へ動かすと握る、下へ動かすと緩める。指を離しても、その位置で止まるよ。', wheel: '右手を上へ動かすと握る、下へ動かすと緩める。指を離しても、その位置で止まるよ。',
      ctrl: `${rt}トリガーを引くと握る、離すと緩める。`, key: 'W を押すと握る、S を押すと緩める。離したら、その位置で止まるよ。' },
    steer: { tilt: '右手を左右になぞると舵。離すと、まっすぐに戻るよ。', pad: '右手を左右になぞると舵。離すと、まっすぐに戻るよ。',
      fuse: '右手のパッドを左右に動かすと舵。', wheel: 'スマホをハンドルみたいに回すと舵。時計回りで右、反対で左。',
      ctrl: '右スティックを左右に倒すと舵。', key: 'A で左、D で右に舵。離すと、まっすぐに戻るよ。' },
    pitch: { tilt: 'スマホを前に傾けると伏せる、手前に起こすと起きる。', pad: '左手の丸い姿勢パッドを上にすると伏せる、下で起こす。',
      wheel: '左手の丸い姿勢パッドを上にすると伏せる、下で起こす。', fuse: '右手のパッドを上にすると伏せる、下で起こす。',
      ctrl: '左スティックを上に倒すと伏せる、下で起こす。', key: '↑ で伏せる、↓ で起こす。' },
    roll: { tilt: 'スマホを曲がる側へ傾けると、体重がかかるよ。', pad: '姿勢パッドを曲がる側へ倒すと、体重がかかるよ。', wheel: '姿勢パッドを曲がる側へ倒すと、体重がかかるよ。',
      fuse: '融合パッドは、舵に合わせて体が勝手に倒れるの。', ctrl: '左スティックを曲がる側へ倒すと、体重がかかるよ。', key: '← と → で、曲がる側へ体重をかけるよ。' },
  };
  return (H[ch] && H[ch][m]) || H[ch].tilt;
}

// ---- the lessons ----
// auto: the controls 羽美 handles; goals: [{text, done(dt) → true}], checked in order; turn lessons use tutTurn()
const TUT_STEPS = [
  { name: 'レバー', auto: ['steer', 'roll', 'pitch'], say: () => ['まずはレバーだけ。舵は、わたしが合わせとくね。', tutHow('thr')],
    goals: [
      { text: 'レバーを全開まで握る', done: dt => tutHold(input.thr > 0.9 && B.v * 3.6 > 60, 1, dt), ok: '…速いでしょ。' },
      { text: 'レバーを握ったまま、マークを回る', turn: { regrip: true }, ok: 'ね、握ったままでも回れるでしょ。', okRel: '回れたね。…今度、緩めないで回ってみて。けっこう回れるよ。' }] },
  { name: '舵', auto: ['thr', 'roll', 'pitch'], say: () => ['次は舵。レバーは、わたしがやっとく。', tutHow('steer'), 'わたしの通ったとこ、なぞってきて。'],
    goals: [{ text: '羽美の後ろについて、マークを回る', turn: { near: 14 }, ok: 'ついてこれた。' }] },
  { name: '姿勢', auto: ['thr', 'steer', 'roll'], say: () => ['伏せると、まっすぐがよく伸びるよ。起こすと、ふらつきにくいの。', tutHow('pitch')],
    goals: [
      { text: '直線で伏せる', done: dt => tutHold(input.pitch > 0.5 && tutStraight(), 1.5, dt), ok: '…伸びた。' },
      { text: '起こす', done: dt => tutHold(input.pitch < -0.4, 0.8, dt), ok: 'それで、ふらつきにくくなるの。' }] },
  { name: 'ターン', auto: ['roll'], say: () => ['今度は、レバーと舵とで回ってみよ。体重移動だけ、わたしがやるね。', 'マークの手前から舵を入れて、大きく回るの。わたしは、レバーは握りっぱなし。こわかったら、ちょっと緩めてもいいよ。'],
    goals: [{ text: 'レバーと舵でマークを回る', turn: { exit: 30 }, ok: '…いいね。' }] },
  { name: '体重移動', auto: [], say: () => controlMode === 'fuse' ? ['最後の操作は体重移動。', tutHow('roll'), 'ぜんぶ自分で、回ってみよ。'] : ['曲がる側に、体をぐっと倒すの。', tutHow('roll'), 'ぜんぶ自分で、回ってみよ。'],
    goals: [{ text: '曲がる側へ体重をかけて、マークを回る', turn: { lean: controlMode !== 'fuse', exit: 30 }, ok: '鋭く回れたでしょ。' }] },
  { name: '大時計スタート', auto: [], clock: true, say: () => ['最後はスタート。大時計の針が0になってから、1秒以内にスタートラインを越えるの。', '早いとフライング。…わたし、たまにやる。'],
    goals: [{ text: '針が0になってから1秒以内に越える', start: true, ok: 'ばっちり。' }] },
  // d355 (まえ): 最終レッスンは羽美との足合わせ（js/ashi.js）
  { name: '足合わせ', auto: [], ashi: true, say: () => ['最後は、わたしと足合わせ。2周、となりを走ろ。', '1周目はあなたが内側、2周目は外側。2マークのあとの直線で、わたしが入れ替えるね。\n近くを走り続けるほど、点が増えていくよ。離れたら止まる。コンボが長く続くほど、どんどん増えるの。…ぶつかったら、コンボは切れちゃう。'],
    goals: [{ text: '羽美のとなりを走る' }] },
];
const tutStraight = () => Math.abs(B.x) < MK - 50 && Math.abs(B.yaw || 0) < 0.15;
function tutHold(c, need, dt) { TUT.hold = c ? TUT.hold + dt : 0; return TUT.hold >= need; }
// a turn: in at |x| > MK − 45 heading for the mark, the apex behind it (crossing y = 0 past the mark), judged at |x| < MK − 50
function tutTurnStep(g, dt) {
  const T = TUT.turn || (TUT.turn = { st: 'wait', rel: false, re: false, lean: 0, far: 0 });
  const ax = Math.abs(B.x), toward = Math.sign(B.x) * Math.cos(B.a) > 0.2;
  if (T.st === 'wait') { if (ax > MK - 45 && toward) Object.assign(T, { st: 'in', rel: false, re: false, lean: 0, far: 0, y0: Math.sign(B.y) }); return false; }
  if (input.thr < 0.5) T.rel = true;
  if (T.st === 'in') {
    if (g.turn.lean && Math.abs(input.roll) > 0.4 && Math.sign(input.roll) === Math.sign(input.steer) && Math.abs(input.steer) > 0.2) T.lean += dt;
    if (g.turn.near && TUT.off > g.turn.near) T.far += dt;
    if (ax > MK - 2 && Math.sign(B.y) !== T.y0) T.st = 'out';
    return false;
  }
  if (input.thr > 0.9) T.re = true;
  if (ax < MK - 50) {
    const t = g.turn; let why = '';
    if (t.regrip && !T.re) why = '回ったら、また握ってね。';
    else if (t.near && T.far > 1.5) why = 'もうちょっと、わたしの後ろについてきて。';
    else if (t.lean && T.lean < 0.4) why = '曲がるとき、曲がる側へ体を倒してみて。';
    else if (t.exit && B.v * 3.6 < t.exit) why = '出口で、もっと握っていいよ。';
    TUT.turn = null; TUT.lastRel = T.rel;
    if (why) { tutBar(`${TUT_STEPS[TUT.step].goals[TUT.goal].text}　…${why}`); return false; }
    return true;
  }
  return false;
}

// ---- UI ----
function tutUi() {
  if ($('tutBox')) return;
  const css = document.createElement('style');
  css.textContent = `#tutBox{background:rgba(4,20,26,.28);backdrop-filter:none;-webkit-backdrop-filter:none;align-items:flex-start}
#tutBox .card{max-width:620px;margin-top:6vh}#tutBox .tut-face{display:flex;gap:12px;align-items:flex-start}#tutBox img{width:72px;height:72px;border-radius:50%;border:2px solid #e9f5f2;flex:none}
#tutBox .bub{background:#fffaf0;color:#1c2a30;border-radius:12px;padding:8px 14px;font-weight:700;line-height:1.6;flex:1}#tutBox .bub small{display:block;font-size:11px;color:#8a6a3a}
#tutBox .bub .how{display:block;margin-top:6px;padding-top:6px;border-top:1px dashed #d8c9a8;color:#0b4a5c;font-weight:700}#tutBox .ttl{font-size:13px;color:var(--muted,#9fc0cf);margin:0 0 8px}
#tutBox .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
#tutBar{position:fixed;left:50%;top:calc(52px + var(--st,0px));transform:translateX(-50%);z-index:4;display:flex;gap:8px;align-items:center;pointer-events:none;max-width:min(560px,80vw)}
@media (max-width:1000px){#tutBar{top:calc(94px + var(--st,0px))}}   /* d387: below the top-right buttons (やり直し added) on phones */
#tutBar img{width:38px;height:38px;border-radius:50%;border:2px solid #e9f5f2;flex:none}#tutBar span{background:rgba(255,250,240,.93);color:#1c2a30;border-radius:10px;padding:4px 10px;font-weight:700;font-size:14px;line-height:1.4}`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.className = 'overlay'; box.id = 'tutBox'; box.hidden = true;
  box.innerHTML = '<div class="card"><p class="ttl" id="tutTtl"></p><div class="tut-face"><img src="manga/umi_face.webp" alt="羽美" width="72" height="72"><p class="bub"><small>羽美</small><span id="tutTxt"></span><span class="how" id="tutHow"></span></p></div><div class="row" id="tutBtns"></div></div>';
  document.body.appendChild(box);
  const bar = document.createElement('div'); bar.id = 'tutBar'; bar.hidden = true;
  bar.innerHTML = '<img src="manga/umi_face.webp" alt="" width="38" height="38"><span id="tutBarTxt"></span>';
  document.body.appendChild(bar);
}
function tutTalk(title, lines, how, btns) {
  tutUi(); paused = true;
  $('tutTtl').textContent = title; $('tutTxt').textContent = lines.join('\n'); $('tutTxt').style.whiteSpace = 'pre-line';
  $('tutHow').textContent = how || ''; $('tutHow').hidden = !how;
  const row = $('tutBtns'); row.textContent = '';
  for (const [label, fn, main] of btns) { const b = document.createElement('button'); b.className = 'btn' + (main ? '' : ' ghost'); b.textContent = label; b.addEventListener('click', fn); row.appendChild(b); }
  $('tutBox').hidden = false; $('tutBar').hidden = true;
  setTimeout(() => { const b = row.querySelector('button:not(.ghost)') || row.querySelector('button'); if (b) b.focus(); }, 50);
}
function tutBar(text) { tutUi(); TUT.said = text; $('tutBarTxt').textContent = text; $('tutBar').hidden = !text; }
function tutGo() { if (!TUT.handoff) TUT.hand = null; $('tutBox').hidden = true; paused = false; last = performance.now(); TUT.phase = 'run'; tutBar(TUT_STEPS[TUT.step].goals[TUT.goal].text); }

// ---- flow ----
function beginTutorial() {
  closeMenu(); if (fleet) quitFleet();
  if (VENUE.id !== 'standard') { TUT.venue0 = VENUE.id; setVenue('standard', false); }
  TUT.on = true; TUT.step = -1; TUT.phase = 'talk';
  if (typeof taShow === 'function' && $('taBox')) $('taBox').hidden = true;
  tutPlace();
  tutTalk('チュートリアル', ['いっしょに走ろ。わたしの後ろ、ついてきて〜。', 'ぶつかっても平気。わたし、ゴーストだから。'], '', [['はじめる', () => tutStep(0), true], ['足合わせだけ', () => tutStep(TUT_STEPS.findIndex(x => x.ashi))], ['やめる', tutQuit]]);
}
// on her line, a few boat lengths behind her, rolling
function tutPlace(back = 0) {
  soloKind = 'tut'; resetBoat(); SS.phase = 'off'; $('clock').hidden = true; practiceSlit = null; meas.on = false;
  const S = TUT.phase === 'run' ? TUT.S - back : 0, p = tutAt(S);
  Object.assign(B, { x: p.x, y: p.y, a: p.a, v: Math.max(8, Math.min(p.v, 14)), cap: 0 });
  cam.x = B.x; cam.y = B.y; lap.prevY = B.y; TUT.idx = 0; TUT.lap = 0; tutMatchFrom(S);
}
function tutMatchFrom(S) { const { p, n, L } = TP; const s = ((S % L) + L) % L; let i = 0; while (i < n - 1 && p[i + 1].s <= s) i++; TUT.idx = i; TUT.lap = Math.floor(S / L); TUT.S = S; TUT.off = 0; }
function tutStep(i) {
  TUT.step = i; TUT.goal = 0; TUT.hold = 0; TUT.turn = null;
  const st = TUT_STEPS[i];
  const pv = TUT_STEPS[i - 1]; TUT.handoff = !!(st && pv && pv.auto.includes('steer') && !st.auto.includes('steer') && !st.clock && !st.ashi);
  if (!st) { tutDone(); return; }
  const lines = st.say(), how = lines.length > 1 ? lines.slice(1).join('\n') : '';
  if (st.ashi) { TUT.phase = 'talk'; tutTalk(`レッスン ${i + 1}／${TUT_STEPS.length}　${st.name}`, [lines[0]], how, [['OK', () => { tutGo(); ashiBegin(); }, true], ['やめる', tutQuit]]); return; }
  if (st.clock) { TUT.phase = 'talk'; tutTalk(`レッスン ${i + 1}／${TUT_STEPS.length}　${st.name}`, [lines[0]], how, [['OK', () => { beginStart(); soloKind = 'clock'; tutGo(); }, true], ['やめる', tutQuit]]); return; }
  TUT.phase = 'talk';
  tutTalk(`レッスン ${i + 1}／${TUT_STEPS.length}　${st.name}`, [lines[0]], how, [['OK', tutGo, true], ['やめる', tutQuit]]);
}
function tutDone() {
  TUT.phase = 'end'; meas.on = false;
  tutTalk('チュートリアル おしまい', ['おしまい。…あとは、走って覚えよ。', 'わたし、パン食べてくる。'], '', [['タイムアタックへ', () => { tutQuit(true); beginTA(); }, true], ['メニューへ', () => { tutQuit(true); menuHome(); }]]);
}
function tutQuit(keep) {
  TUT.on = false; TUT.phase = ''; $('tutBox').hidden = true; $('tutBar').hidden = true;
  if (typeof ashiEnd === 'function') ashiEnd();
  if (TUT.venue0) { setVenue(TUT.venue0, false); TUT.venue0 = null; }
  if (keep !== true) { paused = false; menuHome(); }
}
// per frame, after the input is read: 羽美 handles the controls the lesson leaves to her
function tutAssist(dt) {
  if (!TUT.on || TUT.phase !== 'run' || paused) return;
  const st = TUT_STEPS[TUT.step]; if (!st || st.clock || st.ashi) return;
  if (B.cap > 0) return;
  tutMatch(B); tutGhostRun(dt);
  // her hands keep their own smoothed values (updateInput rewrites input.* from the player's touch every frame)
  const here = tutAt(TUT.S), k = 1 - Math.exp(-dt * 8), H = TUT.hand || (TUT.hand = { thr: input.thr, steer: TUT.handoff ? input.steer : 0, roll: 0, pitch: 0 });
  // d386 (まえ: 伏せるレッスンのあと、操作が戻った瞬間に消波装置にぶつかる): when a lesson gives the rudder back to the player
  // after she had it, she keeps steering until the boat is out on a straight — the lesson could end mid-turn
  if (TUT.handoff && tutStraight() && TUT.off < 6) TUT.handoff = false;
  for (const ch of TUT.handoff ? [...st.auto, 'steer'] : st.auto) {
    let want = here[ch];
    if (ch === 'steer') { const t = tutAt(TUT.S + Math.max(TUT.look, B.v * TUT_K.lookT)); let e = Math.atan2(t.y - B.y, t.x - B.x) - B.a; e = Math.atan2(Math.sin(e), Math.cos(e));
      let eh = here.a - B.a; eh = Math.atan2(Math.sin(eh), Math.cos(eh));   // d386: + her line's direction (damps the swing back across it)
      want = clamp(here.steer + TUT_K.steer * e + TUT_K.damp * eh, -1, 1); }
    H[ch] += (want - H[ch]) * k; input[ch] = H[ch];
  }
}
// d386: lookT = s of run to look ahead when fast (the boat swung side to side out of the marks)
const TUT_K = { steer: 1.6, lookT: 1.0, damp: 0.8 };
// per physics step: goals, capsize, the big-clock lesson
function tutTick(dt) {
  if (!TUT.on || TUT.phase !== 'run') return;
  const st = TUT_STEPS[TUT.step]; if (!st || st.ashi) return;
  if (B.cap > 0) {   // 転覆: back on her line a little behind, the same goal again
    TUT.capT += dt; if (TUT.capT > 2.2) { TUT.capT = 0; TUT.turn = null; TUT.hold = 0; if (st.clock) { tutStep(TUT.step); return; } tutPlace(25); tutBar('だいじょうぶ？…もう一回ね。'); setTimeout(() => { if (TUT.on && TUT.phase === 'run') tutBar(st.goals[TUT.goal].text); }, 2500); }
    return;
  }
  // lost (far off her line for a while, e.g. against the wall): back onto it
  if (!st.clock) { TUT.offT = TUT.off > 40 ? TUT.offT + dt : 0;
    if (TUT.offT > 3) { TUT.offT = 0; TUT.turn = null; TUT.hold = 0; tutPlace(25); tutBar('こっちだよ〜。…わたしの後ろ、ついてきて。'); setTimeout(() => { if (TUT.on && TUT.phase === 'run') tutBar(st.goals[TUT.goal].text); }, 2500); return; } }
  const g = st.goals[TUT.goal];
  let ok = false;
  if (g.start) {
    if (SS.phase === 'done' || SS.phase === 'off') {
      const s = meas.st;
      if (s != null && s >= 0 && s <= 1) ok = true;
      else { TUT.phase = 'talk'; tutTalk(`レッスン ${TUT.step + 1}／${TUT_STEPS.length}　${st.name}`, [s != null && s < 0 ? '早かったね。…針が0になるのを待ってから。' : '遅れちゃった。0になったら、すぐ越えるの。'], '', [['もう一回', () => { beginStart(); soloKind = 'clock'; tutGo(); }, true], ['やめる', tutQuit]]); return; }
    }
  } else if (g.turn) ok = tutTurnStep(g, dt);
  else ok = g.done(dt);
  if (!ok) return;
  TUT.hold = 0; TUT.turn = null;
  const okText = g.okRel && TUT.lastRel ? g.okRel : g.ok; TUT.lastRel = false;
  const next = st.goals[TUT.goal + 1];
  if (next) { TUT.goal++; tutBar(`${okText}　次は：${next.text}`); return; }
  TUT.phase = 'talk'; tutBar('');
  tutTalk(`レッスン ${TUT.step + 1}／${TUT_STEPS.length}　${st.name}`, [okText], '', [['次へ', () => tutStep(TUT.step + 1), true], ['やめる', tutQuit]]);
}
{ const _ui = updateInput; updateInput = function (dt) { _ui(dt); tutAssist(dt); }; }
{ const _st = step; step = function (dt) { _st(dt); tutTick(dt); }; }
// やり直し (R / メニューのやり直し) in a lesson: back onto her line, or the big clock again
{ const _sr = soloRestart; soloRestart = function () { if (!TUT.on) return _sr();
  if (TUT.phase !== 'run') return; TUT.turn = null; TUT.hold = 0;
  if (TUT_STEPS[TUT.step] && TUT_STEPS[TUT.step].clock) { beginStart(); return; }
  if (TUT_STEPS[TUT.step] && TUT_STEPS[TUT.step].ashi) { ashiBegin(); return; }
  tutPlace(25); tutBar(TUT_STEPS[TUT.step].goals[TUT.goal].text); }; }
// leaving for another mode ends it
for (const id of ['pmTA', 'pmRaceMode', 'pmRaceAgain', 'pmTenji', 'pmClock', 'pm6', 'pmRace', 'goDemo']) { const el = $(id); if (el) el.addEventListener('click', () => { if (TUT.on) tutQuit(true); }, true); }
$('pmTut') && $('pmTut').addEventListener('click', () => beginTutorial());
