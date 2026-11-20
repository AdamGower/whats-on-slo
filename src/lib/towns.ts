import { slugify } from "./slug.ts";
// Relative imports with extensions so the node test runner can load this file.

// Every town with events in the data, with its /towns/[slug] page copy. The
// intros are written for visitors and kept factual: 80 to 120 words each
// (scripts/towns.test.mjs checks the range).

export type Region = "San Luis Obispo and Avila" | "North Coast" | "North County" | "South County";

export type Town = {
  name: string;
  slug: string;
  region: Region;
  intro: string;
};

const TOWN_LIST: Omit<Town, "slug">[] = [
  {
    name: "San Luis Obispo",
    region: "San Luis Obispo and Avila",
    intro:
      "San Luis Obispo is the county seat and the home of Cal Poly, set about halfway between Los Angeles and San Francisco on Highway 101. Downtown grew up around Mission San Luis Obispo de Tolosa, founded in 1772, and the creek walk that runs behind it. Every Thursday evening Higuera Street closes for the downtown farmers market, with produce, food stalls and live music. The city's main stages include the Fremont Theater, SLO Brew Rock and the Performing Arts Center on the Cal Poly campus. Bishop Peak and Cerro San Luis, two of the volcanic Nine Sisters, have trailheads a few minutes from downtown.",
  },
  {
    name: "Avila Beach",
    region: "San Luis Obispo and Avila",
    intro:
      "Avila Beach is a small beach town on San Luis Bay, about ten minutes south of San Luis Obispo. The beach faces south, which shelters it from much of the coastal wind and fog. The town has a short promenade, a public pier and the Central Coast Aquarium. West of town, Port San Luis Harbor has the Harford Pier, fish markets and boat launches, and docent-led hikes go out to the Point San Luis Lighthouse. The Bob Jones Trail, a paved path for walking and cycling, runs inland along San Luis Obispo Creek. Avila Valley and See Canyon have farm stands and apple orchards.",
  },
  {
    name: "Morro Bay",
    region: "North Coast",
    intro:
      "Morro Bay is a working fishing town on the coast north of San Luis Obispo, known for Morro Rock, a volcanic plug that rises 576 feet at the mouth of the harbor. The Embarcadero along the waterfront has seafood restaurants, kayak and paddleboard rentals and harbor cruises. Morro Bay State Park covers the edge of the estuary and includes a golf course, a campground and the Museum of Natural History. The estuary is an important stop for migrating birds, and the town hosts the Morro Bay Winter Bird Festival each January. The downtown streets above the harbor have shops, galleries and cafes.",
  },
  {
    name: "Los Osos",
    region: "North Coast",
    intro:
      "Los Osos sits on the south shore of the Morro Bay estuary, across the water from Morro Rock. It is a quiet residential community with the older Baywood Park neighborhood along the bay, where small cafes and restaurants face the water. Montaña de Oro State Park begins at the southwest edge of town, with coastal bluff trails, tide pools and the climb up Valencia Peak. The Elfin Forest has a boardwalk loop through dwarf oaks above the estuary, and the Sweet Springs Nature Preserve is a short walk for birdwatching. Events here are often small community gatherings, library programs and live music.",
  },
  {
    name: "Cayucos",
    region: "North Coast",
    intro:
      "Cayucos is a small beach town on Highway 1, a few miles north of Morro Bay. Its pier, first built in the 1870s, extends from the center of town and is a common spot for fishing and watching surfers. Ocean Avenue, the main street, has antique shops, surf shops and casual places to eat. The town is known for its Fourth of July celebration and its New Year's Day Polar Bear Dip. Wide beaches run in both directions from the pier, and the rural hills behind town lead toward Highway 46 and the wineries on the way to Paso Robles.",
  },
  {
    name: "Cambria",
    region: "North Coast",
    intro:
      "Cambria is a village on Highway 1 among stands of Monterey pine, about ten miles south of Hearst Castle. The town is split into an East Village and a West Village, both with galleries, antique stores, restaurants and wine tasting rooms. Moonstone Beach has a boardwalk along the bluffs that is popular for sunsets and spotting sea otters. The Fiscalini Ranch Preserve offers trails across open coastal meadow and pine forest between the village and the ocean. Each October the town hosts a scarecrow festival, with handmade scarecrows displayed along the streets. Cambria is a common base for trips up the Big Sur coast.",
  },
  {
    name: "San Simeon",
    region: "North Coast",
    intro:
      "San Simeon is a small coastal community on Highway 1 at the northern end of San Luis Obispo County. It is best known as the gateway to Hearst Castle, the hilltop estate built for William Randolph Hearst and now run as a state historical monument, with guided tours that start at the visitor center. Below the castle, William Randolph Hearst Memorial State Beach has a pier and a sheltered cove. A few miles north, the Piedras Blancas elephant seal rookery has a roadside viewing area that is open year round. San Simeon is also one of the last places to stop for services before the long drive north through Big Sur.",
  },
  {
    name: "Paso Robles",
    region: "North County",
    intro:
      "Paso Robles is the largest town in northern San Luis Obispo County and the center of a wine region with more than 200 wineries. Downtown is built around City Park, which hosts concerts, festivals and car shows through the year, and the surrounding blocks have tasting rooms, restaurants and shops. The Paso Robles Event Center holds the California Mid-State Fair each summer along with rodeos, concerts and trade shows. Sensorio, a large light installation on the east side of town, runs in the evenings. The town has a long history as a hot springs resort, and several mineral spring spas still operate nearby.",
  },
  {
    name: "Atascadero",
    region: "North County",
    intro:
      "Atascadero sits between San Luis Obispo and Paso Robles along Highway 101. It was founded in 1913 as a planned colony by publisher Edward Gardner Lewis, and his domed administration building still serves as City Hall at the center of town. Atascadero Lake Park has a walking loop around the lake and is next to the Charles Paddock Zoo. The Sunken Gardens in front of City Hall host summer concerts, the farmers market and community events. The town celebrates its founding each fall with Colony Days. Trails at Stadium Park and the Three Bridges Oak Preserve lead into the oak-covered hills above town.",
  },
  {
    name: "Templeton",
    region: "North County",
    intro:
      "Templeton is a small town just south of Paso Robles, with a short Main Street of older storefronts, restaurants and a feed store that reflect its roots as a railroad and farming town. The hills to the west are part of the Templeton Gap District, a wine growing area where cool ocean air reaches inland through gaps in the Santa Lucia Range, and many wineries along Vineyard Drive and Highway 46 have tasting rooms open to visitors. Templeton Community Park is the setting for summer concerts and local events. The town is a short drive from both downtown Paso Robles and Atascadero.",
  },
  {
    name: "Santa Margarita",
    region: "North County",
    intro:
      "Santa Margarita is a small town on Highway 58, just north of the Cuesta Grade and about fifteen minutes from San Luis Obispo. Its few blocks of El Camino Real have a cafe, a saloon, a library and a general store. The town sits on the edge of the historic Santa Margarita Ranch, whose land still surrounds it. Santa Margarita Lake, a reservoir about ten miles southeast, is a county park with hiking and biking trails, fishing, boat rentals and campgrounds, though swimming is not allowed. Highway 58 continues east from town through ranch country toward the Carrizo Plain.",
  },
  {
    name: "Creston",
    region: "North County",
    intro:
      "Creston is a rural community in the hills southeast of Paso Robles and east of Atascadero, reached by Highway 41 and Creston Road. The area is mostly cattle ranches, horse properties, oak woodland and vineyards, and several wineries in the surrounding El Pomar and Creston area have tasting rooms open to visitors. The small town center has a general store and a few local businesses. Events here are usually ranch and winery gatherings or community events at local halls. Creston is a quieter alternative to the busier wine trails closer to Paso Robles, and the drive through the hills is part of the appeal.",
  },
  {
    name: "Shandon",
    region: "North County",
    intro:
      "Shandon is a small unincorporated town in eastern San Luis Obispo County, about eighteen miles east of Paso Robles along Highway 46. The surrounding land is dry farming, cattle ranches and vineyards, and the town is far enough inland that summers run much hotter than on the coast. Shandon has a library branch, a school and a community park where local events take place. Highway 46 continues east past the town toward Cholame, where a memorial marks the place where the actor James Dean died in 1955, and on toward the Central Valley. Visitors often pass through on the way between the coast and Interstate 5.",
  },
  {
    name: "San Miguel",
    region: "North County",
    intro:
      "San Miguel is a small town along the Salinas River and Highway 101, about ten miles north of Paso Robles. It is home to Mission San Miguel Arcángel, founded in 1797, which still has the original painted interior in its church and is open for self-guided tours. Next to the mission is the Rios-Caledonia Adobe, a two-story adobe from the 1840s that later served as a stagecoach stop and is now a museum. Mission Street has a handful of restaurants and shops. Wineries in the hills around town are part of the Paso Robles wine region, and the town has a branch library that hosts local events.",
  },
  {
    name: "Pismo Beach",
    region: "South County",
    intro:
      "Pismo Beach is a beach town on the south coast of San Luis Obispo County, about fifteen minutes from San Luis Obispo. Its pier extends from the end of Pomeroy Avenue, with surfing on both sides and a downtown of restaurants and shops a block inland. From roughly November through February, thousands of western monarch butterflies cluster in the eucalyptus trees at the Pismo State Beach Monarch Butterfly Grove, where docents give talks. The town holds the Pismo Beach Clam Festival each October. North of downtown, the Shell Beach neighborhood has bluff top parks, tide pools and paths along the cliffs.",
  },
  {
    name: "Grover Beach",
    region: "South County",
    intro:
      "Grover Beach sits between Pismo Beach and Oceano on the south coast, and its long, flat beach is part of Pismo State Beach. At the foot of Grand Avenue, a beach ramp lets vehicles drive onto the sand toward the Oceano Dunes, one of the few places in California where driving on the beach is allowed. Grand Avenue is the main street, with restaurants, brewery taprooms and shops. The town has an Amtrak station served by the Pacific Surfliner, which makes it one of the easier places on the coast to reach by train. The Pismo State Beach campground and golf course are on its southern edge.",
  },
  {
    name: "Oceano",
    region: "South County",
    intro:
      "Oceano is an unincorporated beach community on the south coast, next to the Oceano Dunes State Vehicular Recreation Area, where off-highway vehicles and camping are allowed on the sand. South of the vehicle area, the Guadalupe-Nipomo Dunes stretch for miles and include protected wildlife habitat and walking trails. Oceano is also home to the Great American Melodrama and Vaudeville, a long-running theater that stages old-fashioned melodramas with audience participation followed by a vaudeville revue. The Oceano Depot, a restored railroad station, houses a small museum. The town has a quiet residential feel and a small airport near the beach.",
  },
  {
    name: "Arroyo Grande",
    region: "South County",
    intro:
      "Arroyo Grande is an inland town in the south of the county, a few minutes from the beaches at Pismo and Grover Beach. Its Village district along Branch Street has historic brick and wood storefronts, restaurants, antique stores and tasting rooms. A swinging footbridge over Arroyo Grande Creek connects the Village to a park on the far bank. The town hosts the Arroyo Grande Strawberry Festival each May, which closes the Village streets for food, music and crafts. Lopez Lake, about ten miles east, has camping, boating and hiking, and the Edna Valley wine region lies just to the north.",
  },
  {
    name: "Nipomo",
    region: "South County",
    intro:
      "Nipomo is an unincorporated community at the southern end of San Luis Obispo County, along Highway 101 just north of the Santa Maria River. The Dana Adobe, built in the 1830s by early rancher William Dana, is now a cultural center with exhibits, trails and events through the year. Nipomo Regional Park has open space, sports fields and walking paths, and the Nipomo Mesa to the west leads toward the Guadalupe-Nipomo Dunes. The area has strawberry fields, nurseries and a few wineries. Old Town Nipomo, near the Dana Adobe, has a handful of restaurants and shops along Tefft Street and Thompson Avenue.",
  },
  {
    name: "Santa Maria",
    region: "South County",
    intro:
      "Santa Maria is just across the Santa Maria River from Nipomo, in northern Santa Barbara County, and is the largest city near the southern edge of San Luis Obispo County. It gives its name to Santa Maria-style barbecue, beef such as tri-tip grilled over red oak and served with pinquito beans and salsa, which local restaurants and roadside cookouts serve on weekends. The Santa Maria Valley is a wine region known for Pinot Noir and Chardonnay, with tasting rooms along the Foxen Canyon Wine Trail. The Santa Maria Fairpark hosts the county fair, concerts and shows through the year, and the city has a historical museum.",
  },
];

export const TOWNS: Town[] = TOWN_LIST.map((t) => ({ ...t, slug: slugify(t.name) }));

export const REGIONS: Region[] = [
  "San Luis Obispo and Avila",
  "North Coast",
  "North County",
  "South County",
];

const BY_NAME = new Map(TOWNS.map((t) => [t.name.toLowerCase(), t]));
const BY_SLUG = new Map(TOWNS.map((t) => [t.slug, t]));

export function townBySlug(slug: string): Town | undefined {
  return BY_SLUG.get(slug);
}

export function townByName(name: string): Town | undefined {
  return BY_NAME.get(name.toLowerCase());
}

// Known variants in the scraped `community` column: typos, a trailing comma,
// a neighborhood or a street address standing in for the town. Only the
// rendered value is cleaned; rows in the database are left as they are.
const ALIASES: Record<string, string> = {
  "san luis obsipo": "San Luis Obispo",
  "san luis obipso": "San Luis Obispo",
  "san luis obispo ca": "San Luis Obispo",
  "downtown san luis obispo": "San Luis Obispo",
  slo: "San Luis Obispo",
  "900 palm st": "San Luis Obispo",
  "port san luis": "Avila Beach",
  "paso": "Paso Robles",
};

export function normalizeCommunity(raw: string): string {
  const trimmed = (raw ?? "").replace(/\s+/g, " ").replace(/[\s,]+$/g, "").trim();
  const key = trimmed.toLowerCase().replace(/[.,]/g, "");
  const alias = ALIASES[key];
  if (alias) return alias;
  const known = BY_NAME.get(key);
  return known ? known.name : trimmed;
}
