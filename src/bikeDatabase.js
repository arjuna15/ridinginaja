// Comprehensive Motorcycle Database
// Includes popular bikes from Indonesia & worldwide

const bikeDatabase = [
  // === HONDA ===
  { brand: 'Honda', name: 'Beat', type: 'Matic', cc: 110, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/2020_Honda_BeAT_%28front%29.jpg/280px-2020_Honda_BeAT_%28front%29.jpg' },
  { brand: 'Honda', name: 'Vario 125', type: 'Matic', cc: 125, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/2022_Honda_Vario_125_%28front%29.jpg/280px-2022_Honda_Vario_125_%28front%29.jpg' },
  { brand: 'Honda', name: 'Vario 160', type: 'Matic', cc: 160, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/2022_Honda_Vario_160_%28front%29.jpg/280px-2022_Honda_Vario_160_%28front%29.jpg' },
  { brand: 'Honda', name: 'Scoopy', type: 'Matic', cc: 110, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/2017_Honda_Scoopy_eSP.jpg/280px-2017_Honda_Scoopy_eSP.jpg' },
  { brand: 'Honda', name: 'PCX 160', type: 'Matic', cc: 160, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/2021_Honda_PCX_160_%28front%29.jpg/280px-2021_Honda_PCX_160_%28front%29.jpg' },
  { brand: 'Honda', name: 'ADV 160', type: 'Adventure', cc: 160, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Honda_ADV_160_%28front%29.jpg/280px-Honda_ADV_160_%28front%29.jpg' },
  { brand: 'Honda', name: 'CBR150R', type: 'Sport', cc: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Honda_CBR150R.jpg/280px-Honda_CBR150R.jpg' },
  { brand: 'Honda', name: 'CBR250RR', type: 'Sport', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/2022_Honda_CBR250RR_%28front%29.jpg/280px-2022_Honda_CBR250RR_%28front%29.jpg' },
  { brand: 'Honda', name: 'CB150R', type: 'Naked', cc: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Honda_CB150R_StreetFire.jpg/280px-Honda_CB150R_StreetFire.jpg' },
  { brand: 'Honda', name: 'CRF150L', type: 'Trail', cc: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/2020_Honda_CRF150L.jpg/280px-2020_Honda_CRF150L.jpg' },
  { brand: 'Honda', name: 'CRF250Rally', type: 'Adventure', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Honda_CRF250_Rally.jpg/280px-Honda_CRF250_Rally.jpg' },
  { brand: 'Honda', name: 'Rebel 500', type: 'Cruiser', cc: 500, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Honda_Rebel_500_%28CMX500%29.jpg/280px-Honda_Rebel_500_%28CMX500%29.jpg' },
  { brand: 'Honda', name: 'CB500X', type: 'Adventure', cc: 500, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Honda_CB500X.jpg/280px-Honda_CB500X.jpg' },
  { brand: 'Honda', name: 'CBR600RR', type: 'Supersport', cc: 600, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Honda_CBR600RR_%282021%29.jpg/280px-Honda_CBR600RR_%282021%29.jpg' },
  { brand: 'Honda', name: 'CBR1000RR-R', type: 'Superbike', cc: 1000, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Honda_CBR1000RR-R.jpg/280px-Honda_CBR1000RR-R.jpg' },
  { brand: 'Honda', name: 'Africa Twin', type: 'Adventure', cc: 1100, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Honda_Africa_Twin_%282020%29.jpg/280px-Honda_Africa_Twin_%282020%29.jpg' },
  { brand: 'Honda', name: 'Gold Wing', type: 'Touring', cc: 1833, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Honda_Gold_Wing_GL1800.jpg/280px-Honda_Gold_Wing_GL1800.jpg' },
  { brand: 'Honda', name: 'Monkey 125', type: 'Retro', cc: 125, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Honda_Monkey_125.jpg/280px-Honda_Monkey_125.jpg' },
  { brand: 'Honda', name: 'CT125 Hunter Cub', type: 'Retro', cc: 125, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Honda_CT125.jpg/280px-Honda_CT125.jpg' },
  { brand: 'Honda', name: 'Forza 250', type: 'Matic', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Honda_Forza_250.jpg/280px-Honda_Forza_250.jpg' },
  
  // === YAMAHA ===
  { brand: 'Yamaha', name: 'NMAX 155', type: 'Matic', cc: 155, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Yamaha_NMAX_155_%28front%29.jpg/280px-Yamaha_NMAX_155_%28front%29.jpg' },
  { brand: 'Yamaha', name: 'Aerox 155', type: 'Matic', cc: 155, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Yamaha_Aerox_155.jpg/280px-Yamaha_Aerox_155.jpg' },
  { brand: 'Yamaha', name: 'Mio M3 125', type: 'Matic', cc: 125, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Yamaha_Mio_M3_125.jpg/280px-Yamaha_Mio_M3_125.jpg' },
  { brand: 'Yamaha', name: 'Fazzio', type: 'Matic', cc: 125, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Yamaha_Fazzio.jpg/280px-Yamaha_Fazzio.jpg' },
  { brand: 'Yamaha', name: 'Lexi 125', type: 'Matic', cc: 125, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Yamaha_LEXi_125.jpg/280px-Yamaha_LEXi_125.jpg' },
  { brand: 'Yamaha', name: 'XMAX 250', type: 'Matic', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Yamaha_XMAX_%28front%29.jpg/280px-Yamaha_XMAX_%28front%29.jpg' },
  { brand: 'Yamaha', name: 'R15 V4', type: 'Sport', cc: 155, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/2021_Yamaha_YZF-R15.jpg/280px-2021_Yamaha_YZF-R15.jpg' },
  { brand: 'Yamaha', name: 'R25', type: 'Sport', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Yamaha_YZF-R25.jpg/280px-Yamaha_YZF-R25.jpg' },
  { brand: 'Yamaha', name: 'MT-25', type: 'Naked', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Yamaha_MT-25.jpg/280px-Yamaha_MT-25.jpg' },
  { brand: 'Yamaha', name: 'MT-15', type: 'Naked', cc: 155, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Yamaha_MT-15.jpg/280px-Yamaha_MT-15.jpg' },
  { brand: 'Yamaha', name: 'XSR 155', type: 'Retro', cc: 155, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Yamaha_XSR_155.jpg/280px-Yamaha_XSR_155.jpg' },
  { brand: 'Yamaha', name: 'WR155R', type: 'Trail', cc: 155, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Yamaha_WR155R.jpg/280px-Yamaha_WR155R.jpg' },
  { brand: 'Yamaha', name: 'YZF-R6', type: 'Supersport', cc: 600, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Yamaha_YZF-R6.jpg/280px-Yamaha_YZF-R6.jpg' },
  { brand: 'Yamaha', name: 'YZF-R1', type: 'Superbike', cc: 1000, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Yamaha_YZF-R1_%282020%29.jpg/280px-Yamaha_YZF-R1_%282020%29.jpg' },
  { brand: 'Yamaha', name: 'MT-07', type: 'Naked', cc: 689, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/2018_Yamaha_MT-07.jpg/280px-2018_Yamaha_MT-07.jpg' },
  { brand: 'Yamaha', name: 'MT-09', type: 'Naked', cc: 890, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/2021_Yamaha_MT-09.jpg/280px-2021_Yamaha_MT-09.jpg' },
  { brand: 'Yamaha', name: 'Tenere 700', type: 'Adventure', cc: 689, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Yamaha_T%C3%A9n%C3%A9r%C3%A9_700.jpg/280px-Yamaha_T%C3%A9n%C3%A9r%C3%A9_700.jpg' },
  { brand: 'Yamaha', name: 'TMAX', type: 'Matic', cc: 560, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Yamaha_TMAX.jpg/280px-Yamaha_TMAX.jpg' },
  { brand: 'Yamaha', name: 'VMAX', type: 'Cruiser', cc: 1679, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Yamaha_VMAX.jpg/280px-Yamaha_VMAX.jpg' },

  // === KAWASAKI ===
  { brand: 'Kawasaki', name: 'Ninja 250', type: 'Sport', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Kawasaki_Ninja_250.jpg/280px-Kawasaki_Ninja_250.jpg' },
  { brand: 'Kawasaki', name: 'Ninja ZX-25R', type: 'Sport', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kawasaki_Ninja_ZX-25R.jpg/280px-Kawasaki_Ninja_ZX-25R.jpg' },
  { brand: 'Kawasaki', name: 'Ninja 400', type: 'Sport', cc: 399, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/2018_Kawasaki_Ninja_400.jpg/280px-2018_Kawasaki_Ninja_400.jpg' },
  { brand: 'Kawasaki', name: 'Ninja 650', type: 'Sport', cc: 649, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Kawasaki_Ninja_650_%282017%29.jpg/280px-Kawasaki_Ninja_650_%282017%29.jpg' },
  { brand: 'Kawasaki', name: 'Ninja ZX-6R', type: 'Supersport', cc: 636, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Kawasaki_Ninja_ZX-6R_%282019%29.jpg/280px-Kawasaki_Ninja_ZX-6R_%282019%29.jpg' },
  { brand: 'Kawasaki', name: 'Ninja ZX-10R', type: 'Superbike', cc: 998, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Kawasaki_Ninja_ZX-10R.jpg/280px-Kawasaki_Ninja_ZX-10R.jpg' },
  { brand: 'Kawasaki', name: 'Z250', type: 'Naked', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Kawasaki_Z250.jpg/280px-Kawasaki_Z250.jpg' },
  { brand: 'Kawasaki', name: 'Z650', type: 'Naked', cc: 649, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Kawasaki_Z650.jpg/280px-Kawasaki_Z650.jpg' },
  { brand: 'Kawasaki', name: 'Z900', type: 'Naked', cc: 948, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Kawasaki_Z900.jpg/280px-Kawasaki_Z900.jpg' },
  { brand: 'Kawasaki', name: 'Z H2', type: 'Naked', cc: 998, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Kawasaki_Z_H2.jpg/280px-Kawasaki_Z_H2.jpg' },
  { brand: 'Kawasaki', name: 'KLX 150', type: 'Trail', cc: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Kawasaki_KLX_150.jpg/280px-Kawasaki_KLX_150.jpg' },
  { brand: 'Kawasaki', name: 'KLX 230', type: 'Trail', cc: 233, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Kawasaki_KLX230.jpg/280px-Kawasaki_KLX230.jpg' },
  { brand: 'Kawasaki', name: 'Versys 650', type: 'Adventure', cc: 649, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Kawasaki_Versys_650.jpg/280px-Kawasaki_Versys_650.jpg' },
  { brand: 'Kawasaki', name: 'Versys 1000', type: 'Adventure', cc: 1043, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Kawasaki_Versys_1000.jpg/280px-Kawasaki_Versys_1000.jpg' },
  { brand: 'Kawasaki', name: 'Vulcan S', type: 'Cruiser', cc: 649, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Kawasaki_Vulcan_S.jpg/280px-Kawasaki_Vulcan_S.jpg' },
  { brand: 'Kawasaki', name: 'W175', type: 'Retro', cc: 177, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Kawasaki_W175.jpg/280px-Kawasaki_W175.jpg' },
  { brand: 'Kawasaki', name: 'W800', type: 'Retro', cc: 773, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Kawasaki_W800.jpg/280px-Kawasaki_W800.jpg' },

  // === SUZUKI ===
  { brand: 'Suzuki', name: 'Nex Crossover', type: 'Matic', cc: 110, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Suzuki_Nex_II.jpg/280px-Suzuki_Nex_II.jpg' },
  { brand: 'Suzuki', name: 'Address', type: 'Matic', cc: 113, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Suzuki_Address_110.jpg/280px-Suzuki_Address_110.jpg' },
  { brand: 'Suzuki', name: 'Burgman Street', type: 'Matic', cc: 125, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Suzuki_Burgman_Street.jpg/280px-Suzuki_Burgman_Street.jpg' },
  { brand: 'Suzuki', name: 'GSX-R150', type: 'Sport', cc: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Suzuki_GSX-R150.jpg/280px-Suzuki_GSX-R150.jpg' },
  { brand: 'Suzuki', name: 'GSX-S150', type: 'Naked', cc: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Suzuki_GSX-S150.jpg/280px-Suzuki_GSX-S150.jpg' },
  { brand: 'Suzuki', name: 'GSX-250R', type: 'Sport', cc: 248, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Suzuki_GSX250R.jpg/280px-Suzuki_GSX250R.jpg' },
  { brand: 'Suzuki', name: 'GSX-S750', type: 'Naked', cc: 749, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Suzuki_GSX-S750.jpg/280px-Suzuki_GSX-S750.jpg' },
  { brand: 'Suzuki', name: 'GSX-R1000', type: 'Superbike', cc: 1000, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Suzuki_GSX-R1000.jpg/280px-Suzuki_GSX-R1000.jpg' },
  { brand: 'Suzuki', name: 'V-Strom 650', type: 'Adventure', cc: 645, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Suzuki_V-Strom_650.jpg/280px-Suzuki_V-Strom_650.jpg' },
  { brand: 'Suzuki', name: 'V-Strom 1050', type: 'Adventure', cc: 1037, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Suzuki_V-Strom_1050.jpg/280px-Suzuki_V-Strom_1050.jpg' },
  { brand: 'Suzuki', name: 'Hayabusa', type: 'Superbike', cc: 1340, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Suzuki_Hayabusa_%282021%29.jpg/280px-Suzuki_Hayabusa_%282021%29.jpg' },
  { brand: 'Suzuki', name: 'Katana', type: 'Naked', cc: 999, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Suzuki_Katana_%282019%29.jpg/280px-Suzuki_Katana_%282019%29.jpg' },

  // === KTM ===
  { brand: 'KTM', name: 'Duke 200', type: 'Naked', cc: 200, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/KTM_200_Duke.jpg/280px-KTM_200_Duke.jpg' },
  { brand: 'KTM', name: 'Duke 250', type: 'Naked', cc: 250, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/KTM_250_Duke.jpg/280px-KTM_250_Duke.jpg' },
  { brand: 'KTM', name: 'Duke 390', type: 'Naked', cc: 373, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/KTM_390_Duke.jpg/280px-KTM_390_Duke.jpg' },
  { brand: 'KTM', name: 'RC 200', type: 'Sport', cc: 200, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/KTM_RC_200.jpg/280px-KTM_RC_200.jpg' },
  { brand: 'KTM', name: 'RC 390', type: 'Sport', cc: 373, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/KTM_RC_390.jpg/280px-KTM_RC_390.jpg' },
  { brand: 'KTM', name: '390 Adventure', type: 'Adventure', cc: 373, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/KTM_390_Adventure.jpg/280px-KTM_390_Adventure.jpg' },
  { brand: 'KTM', name: '1290 Super Duke R', type: 'Naked', cc: 1301, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/KTM_1290_Super_Duke_R.jpg/280px-KTM_1290_Super_Duke_R.jpg' },
  { brand: 'KTM', name: '1290 Super Adventure', type: 'Adventure', cc: 1301, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/KTM_1290_Super_Adventure.jpg/280px-KTM_1290_Super_Adventure.jpg' },

  // === DUCATI ===
  { brand: 'Ducati', name: 'Panigale V2', type: 'Supersport', cc: 955, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Ducati_Panigale_V2.jpg/280px-Ducati_Panigale_V2.jpg' },
  { brand: 'Ducati', name: 'Panigale V4', type: 'Superbike', cc: 1103, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Ducati_Panigale_V4.jpg/280px-Ducati_Panigale_V4.jpg' },
  { brand: 'Ducati', name: 'Monster', type: 'Naked', cc: 937, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Ducati_Monster_%282021%29.jpg/280px-Ducati_Monster_%282021%29.jpg' },
  { brand: 'Ducati', name: 'Streetfighter V4', type: 'Naked', cc: 1103, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Ducati_Streetfighter_V4.jpg/280px-Ducati_Streetfighter_V4.jpg' },
  { brand: 'Ducati', name: 'Multistrada V4', type: 'Adventure', cc: 1158, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Ducati_Multistrada_V4.jpg/280px-Ducati_Multistrada_V4.jpg' },
  { brand: 'Ducati', name: 'Scrambler', type: 'Retro', cc: 803, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ducati_Scrambler.jpg/280px-Ducati_Scrambler.jpg' },
  { brand: 'Ducati', name: 'Diavel V4', type: 'Cruiser', cc: 1158, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Ducati_Diavel.jpg/280px-Ducati_Diavel.jpg' },
  { brand: 'Ducati', name: 'Hypermotard 950', type: 'Supermoto', cc: 937, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Ducati_Hypermotard_950.jpg/280px-Ducati_Hypermotard_950.jpg' },

  // === BMW ===
  { brand: 'BMW', name: 'G 310 R', type: 'Naked', cc: 313, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/BMW_G_310_R.jpg/280px-BMW_G_310_R.jpg' },
  { brand: 'BMW', name: 'G 310 GS', type: 'Adventure', cc: 313, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/BMW_G_310_GS.jpg/280px-BMW_G_310_GS.jpg' },
  { brand: 'BMW', name: 'S 1000 RR', type: 'Superbike', cc: 999, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/BMW_S1000RR_%282019%29.jpg/280px-BMW_S1000RR_%282019%29.jpg' },
  { brand: 'BMW', name: 'S 1000 R', type: 'Naked', cc: 999, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/BMW_S_1000_R.jpg/280px-BMW_S_1000_R.jpg' },
  { brand: 'BMW', name: 'R 1250 GS', type: 'Adventure', cc: 1254, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/BMW_R1250GS.jpg/280px-BMW_R1250GS.jpg' },
  { brand: 'BMW', name: 'R nineT', type: 'Retro', cc: 1170, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/BMW_R_nineT.jpg/280px-BMW_R_nineT.jpg' },
  { brand: 'BMW', name: 'F 900 R', type: 'Naked', cc: 895, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/BMW_F_900_R.jpg/280px-BMW_F_900_R.jpg' },
  { brand: 'BMW', name: 'M 1000 RR', type: 'Superbike', cc: 999, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/BMW_M_1000_RR.jpg/280px-BMW_M_1000_RR.jpg' },

  // === HARLEY-DAVIDSON ===
  { brand: 'Harley-Davidson', name: 'Iron 883', type: 'Cruiser', cc: 883, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Harley-Davidson_Sportster_Iron_883.jpg/280px-Harley-Davidson_Sportster_Iron_883.jpg' },
  { brand: 'Harley-Davidson', name: 'Fat Boy', type: 'Cruiser', cc: 1868, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Harley-Davidson_Fat_Boy.jpg/280px-Harley-Davidson_Fat_Boy.jpg' },
  { brand: 'Harley-Davidson', name: 'Street Glide', type: 'Touring', cc: 1868, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Harley-Davidson_Street_Glide.jpg/280px-Harley-Davidson_Street_Glide.jpg' },
  { brand: 'Harley-Davidson', name: 'Road King', type: 'Touring', cc: 1868, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Harley-Davidson_Road_King.jpg/280px-Harley-Davidson_Road_King.jpg' },
  { brand: 'Harley-Davidson', name: 'Pan America', type: 'Adventure', cc: 1252, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Harley-Davidson_Pan_America.jpg/280px-Harley-Davidson_Pan_America.jpg' },
  { brand: 'Harley-Davidson', name: 'Sportster S', type: 'Cruiser', cc: 1252, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Harley-Davidson_Sportster_S.jpg/280px-Harley-Davidson_Sportster_S.jpg' },

  // === TRIUMPH ===
  { brand: 'Triumph', name: 'Street Triple', type: 'Naked', cc: 765, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Triumph_Street_Triple.jpg/280px-Triumph_Street_Triple.jpg' },
  { brand: 'Triumph', name: 'Speed Triple 1200', type: 'Naked', cc: 1160, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Triumph_Speed_Triple_1200_RS.jpg/280px-Triumph_Speed_Triple_1200_RS.jpg' },
  { brand: 'Triumph', name: 'Tiger 900', type: 'Adventure', cc: 888, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Triumph_Tiger_900.jpg/280px-Triumph_Tiger_900.jpg' },
  { brand: 'Triumph', name: 'Bonneville T120', type: 'Retro', cc: 1200, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Triumph_Bonneville_T120.jpg/280px-Triumph_Bonneville_T120.jpg' },
  { brand: 'Triumph', name: 'Trident 660', type: 'Naked', cc: 660, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Triumph_Trident_660.jpg/280px-Triumph_Trident_660.jpg' },
  { brand: 'Triumph', name: 'Daytona 660', type: 'Sport', cc: 660, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Triumph_Daytona_675.jpg/280px-Triumph_Daytona_675.jpg' },
  { brand: 'Triumph', name: 'Rocket 3', type: 'Cruiser', cc: 2458, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Triumph_Rocket_3.jpg/280px-Triumph_Rocket_3.jpg' },

  // === APRILIA ===
  { brand: 'Aprilia', name: 'RS 660', type: 'Supersport', cc: 659, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Aprilia_RS_660.jpg/280px-Aprilia_RS_660.jpg' },
  { brand: 'Aprilia', name: 'Tuono 660', type: 'Naked', cc: 659, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Aprilia_Tuono_660.jpg/280px-Aprilia_Tuono_660.jpg' },
  { brand: 'Aprilia', name: 'RSV4', type: 'Superbike', cc: 1099, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Aprilia_RSV4.jpg/280px-Aprilia_RSV4.jpg' },

  // === ROYAL ENFIELD ===
  { brand: 'Royal Enfield', name: 'Classic 350', type: 'Retro', cc: 349, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Royal_Enfield_Classic_350.jpg/280px-Royal_Enfield_Classic_350.jpg' },
  { brand: 'Royal Enfield', name: 'Himalayan', type: 'Adventure', cc: 411, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Royal_Enfield_Himalayan.jpg/280px-Royal_Enfield_Himalayan.jpg' },
  { brand: 'Royal Enfield', name: 'Meteor 350', type: 'Cruiser', cc: 349, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Royal_Enfield_Meteor_350.jpg/280px-Royal_Enfield_Meteor_350.jpg' },
  { brand: 'Royal Enfield', name: 'Continental GT 650', type: 'Retro', cc: 648, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Royal_Enfield_Continental_GT_650.jpg/280px-Royal_Enfield_Continental_GT_650.jpg' },
  { brand: 'Royal Enfield', name: 'Interceptor 650', type: 'Retro', cc: 648, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Royal_Enfield_Interceptor_650.jpg/280px-Royal_Enfield_Interceptor_650.jpg' },

  // === BENELLI ===
  { brand: 'Benelli', name: 'Panarea 125', type: 'Matic', cc: 125, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Benelli_Panarea_125.jpg/280px-Benelli_Panarea_125.jpg' },
  { brand: 'Benelli', name: 'TNT 249S', type: 'Naked', cc: 249, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Benelli_TNT_25.jpg/280px-Benelli_TNT_25.jpg' },
  { brand: 'Benelli', name: 'Leoncino 250', type: 'Retro', cc: 249, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Benelli_Leoncino.jpg/280px-Benelli_Leoncino.jpg' },
  { brand: 'Benelli', name: 'TRK 502', type: 'Adventure', cc: 500, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Benelli_TRK_502.jpg/280px-Benelli_TRK_502.jpg' },

  // === VESPA / PIAGGIO ===
  { brand: 'Vespa', name: 'Sprint 150', type: 'Matic', cc: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Vespa_Sprint_150.jpg/280px-Vespa_Sprint_150.jpg' },
  { brand: 'Vespa', name: 'Primavera 150', type: 'Matic', cc: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Vespa_Primavera_150.jpg/280px-Vespa_Primavera_150.jpg' },
  { brand: 'Vespa', name: 'GTS 300', type: 'Matic', cc: 300, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Vespa_GTS_300.jpg/280px-Vespa_GTS_300.jpg' },

  // === MV AGUSTA ===
  { brand: 'MV Agusta', name: 'F3 800', type: 'Supersport', cc: 798, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/MV_Agusta_F3_800.jpg/280px-MV_Agusta_F3_800.jpg' },
  { brand: 'MV Agusta', name: 'Brutale 800', type: 'Naked', cc: 798, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/MV_Agusta_Brutale_800.jpg/280px-MV_Agusta_Brutale_800.jpg' },

  // === INDIAN ===
  { brand: 'Indian', name: 'Scout', type: 'Cruiser', cc: 1133, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Indian_Scout.jpg/280px-Indian_Scout.jpg' },
  { brand: 'Indian', name: 'Chief', type: 'Cruiser', cc: 1890, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Indian_Chief.jpg/280px-Indian_Chief.jpg' },

  // === TVS ===
  { brand: 'TVS', name: 'Apache RTR 200', type: 'Naked', cc: 197, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/TVS_Apache_RTR_200.jpg/280px-TVS_Apache_RTR_200.jpg' },
  { brand: 'TVS', name: 'Apache RR 310', type: 'Sport', cc: 312, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/TVS_Apache_RR_310.jpg/280px-TVS_Apache_RR_310.jpg' },
];

export default bikeDatabase;
