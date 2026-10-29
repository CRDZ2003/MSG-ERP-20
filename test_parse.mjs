const samples = [
  '1/2" Flange SORF CL150 SS316/SS316L MAKE: WMASS GERMANY   HEAT NUMBER:889, LN-EB1',
  '3/4" Flange SORF CL150 SS316/SS316L MAKE: WMASS GERMANY   HEAT NUMBER:A-2212, LN-EB1',
  '1 1/2" Flange WNRF 150 Sch 40S SS316/SS316L MAKE: WMASS GERMANY   HEAT NUMBER:A-2212 (15), LN-EB1',
  '1 1/2\'\' Carbon Steel BLRF Flange #150 - A105N MAKE: WMASS GERMANY   HEAT NUMBER:106480 / 0087  LN: DC7',
  '3/4\'\' Carbon Steel SWRF Flange #150 Sch 40/STD - A105N MAKE: WMASS GERMANY   HEAT NUMBER:0028,LN-EB3',
  '1" Flange SORF CL150 SS304/304L MAKE: WMASS GERMANY   HEAT NUMBER: S22408, FC4',
  'SPW GASKET 1.1/2", 300#, CS OUTERING, SS INNER RING, WITH SS316 WINDINGGRAPHITE FILLED',
  '3" Flange SORF CL150 SS316/SS316L (Item #8 - Local Purchase)'
]

function parseMSGDescription(desc) {
  let cleanDesc = desc || ''
  let heatNumber = ''
  let make = 'WMASS GERMANY'
  let location = 'LN-EB1'
  let yom = 2024
  let isLocal = false

  const heatMatch = desc.match(/HEAT\s*(?:NUMBER|NO)?\s*[:#]\s*([A-Za-z0-9\-_/ \(\)\.]+?)(?=\s+(?:LN[:\-]|LN\s*:|LOCAL|FC|EC|DC)|,|\s*$)/i)
  if (heatMatch) {
    heatNumber = heatMatch[1].trim()
    const yomMatch = heatNumber.match(/\((\d{2,4})\)/)
    if (yomMatch) {
      const yr = parseInt(yomMatch[1], 10)
      yom = yr < 100 ? 2000 + yr : yr
      heatNumber = heatNumber.replace(/\s*\(\d{2,4}\)/, '').trim()
    }
  }

  const makeMatch = desc.match(/MAKE\s*[:#]\s*([A-Za-z0-9\- /]+?)(?=\s+HEAT|,|\s*$)/i)
  if (makeMatch) {
    make = makeMatch[1].trim()
  }

  const locMatch = desc.match(/(?:LN[:\-]|LN\s*:|LOCATION[:\-]?|LOCAL-BAY-)\s*([A-Za-z0-9\- ]+?)(?=,|\s*$)/i)
  if (locMatch) {
    location = locMatch[0].trim()
  } else {
    const rawLoc = desc.match(/(?:LN|FC|EC|DC)\s*[-:]?\s*([0-9A-Za-z]+)/i)
    if (rawLoc) location = 'LN-' + rawLoc[0].replace(/[\s:]/g, '')
  }

  if (/local/i.test(desc) || /promat/i.test(desc) || /shree/i.test(desc)) {
    isLocal = true
  }

  cleanDesc = cleanDesc
    .replace(/\s*MAKE\s*[:#].*$/i, '')
    .replace(/\s*HEAT\s*(?:NUMBER|NO)?\s*[:#].*$/i, '')
    .trim()

  return { cleanDesc, heatNumber: heatNumber || (isLocal ? 'LOC-HEAT' : 'STOCK-HEAT'), make, location, yom, isLocal }
}

for (const s of samples) {
  console.log('INPUT:', s)
  console.log('OUTPUT:', parseMSGDescription(s))
  console.log('--------------------------------------------------')
}
