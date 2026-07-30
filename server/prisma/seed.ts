/**
 * Seeds a realistic-looking community so the site can be explored immediately.
 *
 * Every member here is fictional. Names, districts, occupations and the spread
 * across UK regions are chosen to look like a plausible slice of the Gurung
 * community in Britain — Aldershot, Farnborough, Folkestone, Reading, Ashford
 * and Greater London carry the most members, which mirrors where the community
 * actually settled around the Brigade of Gurkhas' garrison towns.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Password123';

interface SeedMember {
  email: string;
  displayName: string;
  gender: 'MALE' | 'FEMALE';
  age: number;
  heightCm: number;
  clan: string;
  motherClan?: string;
  ancestralDistrict: string;
  religion: string;
  gurungFluency: string;
  languages: string[];
  ukRegion: string;
  city: string;
  postcodeArea?: string;
  residencyStatus: string;
  yearsInUk?: number;
  raisedIn: string;
  serviceFamily?: boolean;
  education: string;
  fieldOfStudy?: string;
  occupation: string;
  employmentStatus: string;
  incomeBand?: string;
  diet: string;
  smoking: string;
  drinking: string;
  familyType?: string;
  familyValues: string;
  familyBasedIn?: string;
  brothers?: number;
  sisters?: number;
  headline: string;
  about: string;
  interests: string[];
  lookingFor: string;
  intent: string;
  maritalStatus?: string;
  verified?: boolean;
  profileManagedBy?: string;
}

const MEMBERS: SeedMember[] = [
  {
    email: 'sunita.gurung@example.com',
    displayName: 'Sunita',
    gender: 'FEMALE',
    age: 28,
    heightCm: 158,
    clan: 'lamichhane',
    motherClan: 'ghale',
    ancestralDistrict: 'lamjung',
    religion: 'BUDDHIST',
    gurungFluency: 'CONVERSATIONAL',
    languages: ['nepali', 'english', 'gurung'],
    ukRegion: 'hampshire',
    city: 'Aldershot',
    postcodeArea: 'GU11',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 20,
    raisedIn: 'UK',
    serviceFamily: true,
    education: 'BACHELORS',
    fieldOfStudy: 'Adult Nursing',
    occupation: 'Staff nurse, NHS',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K25_40',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    familyType: 'NUCLEAR',
    familyValues: 'MODERATE',
    familyBasedIn: 'Aldershot, Hampshire',
    brothers: 1,
    sisters: 0,
    headline: 'Nurse, hill-walker, and my aama’s harshest cooking critic',
    about:
      'I came to Aldershot when I was eight, so I am equally at home with dal bhat and a Sunday roast. I work long shifts on a cardiology ward and genuinely love it, though it does mean my weekends are precious. Most of them go on walking the South Downs with friends, volunteering at our local Tamu Dhee events, or driving up to see my cousins in Farnborough. I am close to my parents but I make my own decisions.',
    interests: ['hiking', 'cooking', 'volunteering', 'badminton', 'travel'],
    lookingFor:
      'Someone kind and steady who has their own life going on. I would like to meet a partner who understands the culture I grew up in without needing me to be traditional about everything. Humour matters more to me than a job title.',
    intent: 'MARRIAGE',
    verified: true,
  },
  {
    email: 'bikash.gurung@example.com',
    displayName: 'Bikash',
    gender: 'MALE',
    age: 31,
    heightCm: 172,
    clan: 'ghale',
    motherClan: 'toju',
    ancestralDistrict: 'gorkha',
    religion: 'BUDDHIST',
    gurungFluency: 'NATIVE',
    languages: ['gurung', 'nepali', 'english'],
    ukRegion: 'kent',
    city: 'Folkestone',
    postcodeArea: 'CT19',
    residencyStatus: 'SETTLED',
    yearsInUk: 9,
    raisedIn: 'NEPAL',
    serviceFamily: true,
    education: 'BACHELORS',
    fieldOfStudy: 'Civil Engineering',
    occupation: 'Site engineer',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K40_60',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'SOCIALLY',
    familyType: 'JOINT',
    familyValues: 'TRADITIONAL',
    familyBasedIn: 'Folkestone, Kent',
    brothers: 2,
    sisters: 1,
    headline: 'Engineer from Gorkha, football on Sundays, momo on Saturdays',
    about:
      'I grew up in a village above Gorkha bazaar and moved to Kent after my father finished his service. I work on infrastructure sites across the south east, which means early starts and a lot of tea. I play for a Nepali five-a-side team in Folkestone most Sundays. I speak Tamu Kyi at home with my parents and would like to keep that alive in my own family one day.',
    interests: ['football', 'photography', 'motorbikes', 'cooking', 'trekking'],
    lookingFor:
      'A partner who values family and is happy to build something together slowly. I am not in a rush, but I am serious. I would like to meet someone I can also be friends with.',
    intent: 'MARRIAGE',
    verified: true,
  },
  {
    email: 'anita.tamu@example.com',
    displayName: 'Anita',
    gender: 'FEMALE',
    age: 26,
    heightCm: 162,
    clan: 'ghotane',
    motherClan: 'lamichhane',
    ancestralDistrict: 'kaski',
    religion: 'BUDDHIST',
    gurungFluency: 'BASIC',
    languages: ['english', 'nepali'],
    ukRegion: 'greater-london',
    city: 'Woolwich, London',
    postcodeArea: 'SE18',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 24,
    raisedIn: 'UK',
    education: 'MASTERS',
    fieldOfStudy: 'Data Science',
    occupation: 'Data analyst, fintech',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K60_85',
    diet: 'EGGETARIAN',
    smoking: 'NEVER',
    drinking: 'SOCIALLY',
    familyType: 'NUCLEAR',
    familyValues: 'LIBERAL',
    familyBasedIn: 'Woolwich, London',
    brothers: 0,
    sisters: 2,
    headline: 'London-born, Pokhara-rooted, currently obsessed with pottery',
    about:
      'Born in Woolwich to parents from Kaski. I work with data at a payments company and spend my evenings at a pottery studio in Deptford making bowls that are slightly too heavy. I am the eldest of three sisters, which probably explains a lot. My Gurung is honestly not good and I would love to be with someone patient enough to help me get better at it.',
    interests: ['pottery', 'live music', 'running', 'films', 'brunch', 'reading'],
    lookingFor:
      'Someone ambitious but grounded, who wants a partnership of equals. I would like to find this myself rather than through introductions, which is why I am here.',
    intent: 'SERIOUS_RELATIONSHIP',
  },
  {
    email: 'raj.gurung@example.com',
    displayName: 'Raj',
    gender: 'MALE',
    age: 34,
    heightCm: 175,
    clan: 'lama',
    motherClan: 'kromchhe',
    ancestralDistrict: 'syangja',
    religion: 'HINDU',
    gurungFluency: 'CONVERSATIONAL',
    languages: ['nepali', 'english', 'hindi'],
    ukRegion: 'berkshire',
    city: 'Reading',
    postcodeArea: 'RG1',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 16,
    raisedIn: 'NEPAL',
    education: 'PROFESSIONAL',
    fieldOfStudy: 'Accountancy (ACCA)',
    occupation: 'Management accountant',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K60_85',
    diet: 'NO_BEEF',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    familyType: 'NUCLEAR',
    familyValues: 'MODERATE',
    familyBasedIn: 'Reading, Berkshire',
    brothers: 1,
    sisters: 1,
    maritalStatus: 'DIVORCED',
    headline: 'Accountant in Reading, learning to cook properly at 34',
    about:
      'I moved to the UK for university and stayed. I am divorced, no children, and honest about it — it was an amicable ending a few years ago and I have taken my time since. I run a small side business helping Nepali families with tax returns, mostly out of stubbornness. Recently I have started cooking seriously and my sel roti is finally acceptable.',
    interests: ['cooking', 'cricket', 'chess', 'cycling', 'podcasts'],
    lookingFor:
      'Someone honest and warm who is looking for a real partnership. I would rather meet someone open-minded about my situation than pretend to be something I am not.',
    intent: 'MARRIAGE',
    verified: true,
  },
  {
    email: 'maya.gurung@example.com',
    displayName: 'Maya',
    gender: 'FEMALE',
    age: 30,
    heightCm: 155,
    clan: 'toju',
    motherClan: 'ghale',
    ancestralDistrict: 'tanahun',
    religion: 'BUDDHIST',
    gurungFluency: 'NATIVE',
    languages: ['gurung', 'nepali', 'english'],
    ukRegion: 'wiltshire',
    city: 'Salisbury',
    postcodeArea: 'SP2',
    residencyStatus: 'SETTLED',
    yearsInUk: 7,
    raisedIn: 'NEPAL',
    serviceFamily: true,
    education: 'BACHELORS',
    fieldOfStudy: 'Business Management',
    occupation: 'Care home team leader',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K25_40',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'NEVER',
    familyType: 'JOINT',
    familyValues: 'TRADITIONAL',
    familyBasedIn: 'Tidworth, Wiltshire',
    brothers: 2,
    sisters: 2,
    headline: 'Tamu Kyi at home, Salisbury at work, Pokhara in my head',
    about:
      'I look after a team in a care home near Salisbury and I am proud of the work even on the hard days. I came here seven years ago with my parents. At home we speak Tamu Kyi, keep Lhosar properly, and my mother still sends me back with a week of food every visit. I sing at community events and I am learning the madal, badly.',
    interests: ['singing', 'dance', 'Lhosar', 'gardening', 'cooking'],
    lookingFor:
      'A gentle, respectful man who is close to his family. I would like someone who keeps our traditions but treats me as an equal. Being able to talk easily matters most.',
    intent: 'MARRIAGE',
  },
  {
    email: 'dipesh.gurung@example.com',
    displayName: 'Dipesh',
    gender: 'MALE',
    age: 27,
    heightCm: 178,
    clan: 'kromchhe',
    motherClan: 'lama',
    ancestralDistrict: 'manang',
    religion: 'BUDDHIST',
    gurungFluency: 'BASIC',
    languages: ['english', 'nepali'],
    ukRegion: 'greater-manchester',
    city: 'Manchester',
    postcodeArea: 'M14',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 22,
    raisedIn: 'UK',
    education: 'BACHELORS',
    fieldOfStudy: 'Computer Science',
    occupation: 'Software developer',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K40_60',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'SOCIALLY',
    familyType: 'NUCLEAR',
    familyValues: 'LIBERAL',
    familyBasedIn: 'Manchester',
    brothers: 1,
    sisters: 1,
    headline: 'Dev in Manchester, climbing walls and eating my way round Rusholme',
    about:
      'Grew up in Manchester, work on backend systems for a logistics company. I climb three times a week at a place in Ancoats and I am slowly getting less bad at it. My family is from Manang originally, which I only really started appreciating in my twenties. I am here because meeting Gurung women in Manchester is harder than it should be.',
    interests: ['climbing', 'coding', 'street food', 'gaming', 'cycling'],
    lookingFor:
      'Someone curious and easy to talk to. I do not need us to want the same things immediately, but I would like us to be heading in a similar direction.',
    intent: 'SERIOUS_RELATIONSHIP',
  },
  {
    email: 'sabina.tamu@example.com',
    displayName: 'Sabina',
    gender: 'FEMALE',
    age: 33,
    heightCm: 160,
    clan: 'pahim',
    motherClan: 'ghotane',
    ancestralDistrict: 'gorkha',
    religion: 'BUDDHIST',
    gurungFluency: 'CONVERSATIONAL',
    languages: ['nepali', 'english', 'gurung'],
    ukRegion: 'hampshire',
    city: 'Farnborough',
    postcodeArea: 'GU14',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 14,
    raisedIn: 'HONG_KONG',
    serviceFamily: true,
    education: 'MASTERS',
    fieldOfStudy: 'Public Health',
    occupation: 'Public health project manager',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K40_60',
    diet: 'VEGETARIAN',
    smoking: 'NEVER',
    drinking: 'NEVER',
    familyType: 'NUCLEAR',
    familyValues: 'MODERATE',
    familyBasedIn: 'Farnborough, Hampshire',
    brothers: 0,
    sisters: 1,
    headline: 'Born in Hong Kong, raised between three places, settled in Hampshire',
    about:
      'My father served with the Brigade so I was born in Hong Kong, spent some childhood in Brunei, and we came to Hampshire when I was nineteen. That mix is a big part of who I am. I work in public health, mostly on community outreach, and I sit on the committee of our local Nepali association. I am vegetarian, I am quiet at parties, and I am much funnier once I know you.',
    interests: ['yoga', 'reading', 'community work', 'baking', 'documentaries'],
    lookingFor:
      'A thoughtful partner who is settled in himself. I would like children eventually and I am looking for someone who wants that too.',
    intent: 'MARRIAGE',
    verified: true,
  },
  {
    email: 'prakash.gurung@example.com',
    displayName: 'Prakash',
    gender: 'MALE',
    age: 29,
    heightCm: 170,
    clan: 'ghotane',
    motherClan: 'pahim',
    ancestralDistrict: 'lamjung',
    religion: 'BUDDHIST',
    gurungFluency: 'NATIVE',
    languages: ['gurung', 'nepali', 'english'],
    ukRegion: 'greater-london',
    city: 'Ashford, Middlesex',
    postcodeArea: 'TW15',
    residencyStatus: 'SKILLED_WORKER',
    yearsInUk: 4,
    raisedIn: 'NEPAL',
    education: 'MASTERS',
    fieldOfStudy: 'Hospitality Management',
    occupation: 'Restaurant general manager',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K40_60',
    diet: 'OMNIVORE',
    smoking: 'OCCASIONALLY',
    drinking: 'SOCIALLY',
    familyType: 'JOINT',
    familyValues: 'TRADITIONAL',
    familyBasedIn: 'Besisahar, Lamjung',
    brothers: 1,
    sisters: 2,
    headline: 'Runs a restaurant near Heathrow, dreams about opening my own',
    about:
      'I manage a busy restaurant near Heathrow and I am saving to open a proper Gurung kitchen of my own — not another generic curry house. I came over on a skilled worker visa four years ago. My family is still in Lamjung and I call my mother every day without fail. I work long hours but I protect my Mondays.',
    interests: ['cooking', 'volleyball', 'travel', 'music', 'business'],
    lookingFor:
      'Someone hardworking and warm who understands that building something takes time. I would like a partner, not just a wedding.',
    intent: 'MARRIAGE',
  },
  {
    email: 'nisha.gurung@example.com',
    displayName: 'Nisha',
    gender: 'FEMALE',
    age: 24,
    heightCm: 157,
    clan: 'chyoje',
    motherClan: 'toju',
    ancestralDistrict: 'kaski',
    religion: 'SPIRITUAL',
    gurungFluency: 'BASIC',
    languages: ['english', 'nepali'],
    ukRegion: 'west-midlands',
    city: 'Birmingham',
    postcodeArea: 'B15',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 21,
    raisedIn: 'UK',
    education: 'BACHELORS',
    fieldOfStudy: 'Graphic Design',
    occupation: 'Junior designer',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'UNDER_25K',
    diet: 'VEGAN',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    familyType: 'NUCLEAR',
    familyValues: 'LIBERAL',
    familyBasedIn: 'Birmingham',
    brothers: 1,
    sisters: 0,
    headline: 'Designer, vegan, permanently covered in ink',
    about:
      'I design brand identities for small businesses in Birmingham and I illustrate for fun. I went vegan three years ago which caused a minor family crisis at Lhosar and we have all recovered. I am the youngest in my family and everyone treats me like I am still twelve. I want to meet people at my own pace.',
    interests: ['illustration', 'vintage shopping', 'concerts', 'yoga', 'cats'],
    lookingFor:
      'Honestly, friendship first. I am not looking to be introduced to someone’s parents in month one. Someone creative or at least curious would be lovely.',
    intent: 'FRIENDSHIP_FIRST',
  },
  {
    email: 'kiran.gurung@example.com',
    displayName: 'Kiran',
    gender: 'MALE',
    age: 36,
    heightCm: 168,
    clan: 'lamichhane',
    motherClan: 'chyoje',
    ancestralDistrict: 'baglung',
    religion: 'HINDU',
    gurungFluency: 'CONVERSATIONAL',
    languages: ['nepali', 'english', 'hindi'],
    ukRegion: 'dorset',
    city: 'Bournemouth',
    postcodeArea: 'BH1',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 18,
    raisedIn: 'NEPAL',
    serviceFamily: true,
    education: 'COLLEGE',
    occupation: 'Self-employed builder',
    employmentStatus: 'SELF_EMPLOYED',
    incomeBand: 'K40_60',
    diet: 'NO_BEEF',
    smoking: 'NEVER',
    drinking: 'SOCIALLY',
    familyType: 'NUCLEAR',
    familyValues: 'MODERATE',
    familyBasedIn: 'Bournemouth, Dorset',
    brothers: 3,
    sisters: 0,
    maritalStatus: 'WIDOWED',
    headline: 'Builder on the south coast, sea swimmer, dad of one',
    about:
      'I run a small building firm around Bournemouth with two of my brothers. I lost my wife four years ago and I have a seven-year-old daughter who is the best thing in my life. I swim in the sea most mornings, which everyone tells me is madness. I am ready to meet someone again, slowly and honestly.',
    interests: ['sea swimming', 'fishing', 'DIY', 'football', 'walking'],
    lookingFor:
      'A patient, kind woman who would be comfortable with a child in the picture from the start. I would never rush that part.',
    intent: 'MARRIAGE',
    verified: true,
  },
  {
    email: 'pooja.tamu@example.com',
    displayName: 'Pooja',
    gender: 'FEMALE',
    age: 29,
    heightCm: 165,
    clan: 'kugi',
    motherClan: 'lama',
    ancestralDistrict: 'dhading',
    religion: 'BUDDHIST',
    gurungFluency: 'CONVERSATIONAL',
    languages: ['nepali', 'english', 'gurung', 'hindi'],
    ukRegion: 'central-scotland',
    city: 'Edinburgh',
    postcodeArea: 'EH8',
    residencyStatus: 'SETTLED',
    yearsInUk: 8,
    raisedIn: 'NEPAL',
    education: 'DOCTORATE',
    fieldOfStudy: 'Molecular Biology',
    occupation: 'Postdoctoral researcher',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K40_60',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    familyType: 'NUCLEAR',
    familyValues: 'MODERATE',
    familyBasedIn: 'Kathmandu, Nepal',
    brothers: 1,
    sisters: 0,
    headline: 'Scientist in Edinburgh, hill-runner, terrible at sitting still',
    about:
      'I came to Edinburgh for a PhD and stayed for the hills. I research antimicrobial resistance, which is as niche as it sounds. Most weekends I am running up something in the Pentlands. My family is in Kathmandu and I go back every year. Scotland has been very good to me but the Nepali community here is small, hence this.',
    interests: ['trail running', 'science', 'hillwalking', 'coffee', 'photography'],
    lookingFor:
      'Someone independent who has their own thing going on. I do not want to be anyone’s project and I would not treat a partner as mine.',
    intent: 'SERIOUS_RELATIONSHIP',
  },
  {
    email: 'anil.gurung@example.com',
    displayName: 'Anil',
    gender: 'MALE',
    age: 32,
    heightCm: 174,
    clan: 'neuchhe',
    motherClan: 'ghotane',
    ancestralDistrict: 'parbat',
    religion: 'BUDDHIST',
    gurungFluency: 'NATIVE',
    languages: ['gurung', 'nepali', 'english'],
    ukRegion: 'kent',
    city: 'Ashford, Kent',
    postcodeArea: 'TN23',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 12,
    raisedIn: 'BRUNEI',
    serviceFamily: true,
    education: 'BACHELORS',
    fieldOfStudy: 'Sports Science',
    occupation: 'Physiotherapist',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K40_60',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    familyType: 'NUCLEAR',
    familyValues: 'MODERATE',
    familyBasedIn: 'Ashford, Kent',
    brothers: 0,
    sisters: 2,
    headline: 'Physio in Kent, ex-county runner, still competitive about everything',
    about:
      'Born in Brunei during my father’s posting, schooled in Kent from age twelve. I work as a physio in an NHS musculoskeletal clinic and coach a junior athletics group on Saturdays. My two younger sisters keep me humble. I speak Tamu Kyi with my parents and I would like my children to hear it too.',
    interests: ['running', 'coaching', 'films', 'cooking', 'hiking'],
    lookingFor:
      'Someone active and warm who takes their own goals seriously. I would like to meet properly rather than message for months.',
    intent: 'MARRIAGE',
  },
  {
    email: 'rekha.gurung@example.com',
    displayName: 'Rekha',
    gender: 'FEMALE',
    age: 35,
    heightCm: 154,
    clan: 'lama',
    motherClan: 'kugi',
    ancestralDistrict: 'myagdi',
    religion: 'BUDDHIST',
    gurungFluency: 'NATIVE',
    languages: ['gurung', 'nepali', 'english'],
    ukRegion: 'hampshire',
    city: 'Aldershot',
    postcodeArea: 'GU12',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 15,
    raisedIn: 'NEPAL',
    serviceFamily: true,
    education: 'COLLEGE',
    occupation: 'Runs a Nepali grocery shop',
    employmentStatus: 'SELF_EMPLOYED',
    incomeBand: 'K25_40',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'NEVER',
    familyType: 'JOINT',
    familyValues: 'TRADITIONAL',
    familyBasedIn: 'Aldershot, Hampshire',
    brothers: 2,
    sisters: 1,
    maritalStatus: 'DIVORCED',
    headline: 'Shopkeeper, feeder of the whole Aldershot Gurung community',
    about:
      'I run a Nepali grocery on Victoria Road and I know everyone’s aama by name. I was married young and it ended eight years ago; no children. I am rebuilding a life I actually chose. I cook far too much food, I love singing at Lhosar, and I am much stronger now than I was at twenty-five.',
    interests: ['cooking', 'singing', 'community events', 'gardening'],
    lookingFor:
      'A straightforward, respectful man who is not put off by my past. I would like companionship and a proper partnership.',
    intent: 'MARRIAGE',
    verified: true,
  },
  {
    email: 'suman.gurung@example.com',
    displayName: 'Suman',
    gender: 'MALE',
    age: 26,
    heightCm: 176,
    clan: 'toju',
    motherClan: 'lamichhane',
    ancestralDistrict: 'kaski',
    religion: 'NONE',
    gurungFluency: 'BASIC',
    languages: ['english', 'nepali'],
    ukRegion: 'west-yorkshire',
    city: 'Leeds',
    postcodeArea: 'LS6',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 19,
    raisedIn: 'UK',
    education: 'MASTERS',
    fieldOfStudy: 'Architecture',
    occupation: 'Architectural assistant',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K25_40',
    diet: 'VEGETARIAN',
    smoking: 'NEVER',
    drinking: 'SOCIALLY',
    familyType: 'NUCLEAR',
    familyValues: 'LIBERAL',
    familyBasedIn: 'Leeds, West Yorkshire',
    brothers: 0,
    sisters: 1,
    headline: 'Architecture, record shops, and a very slow renovation project',
    about:
      'I am working towards qualifying as an architect in Leeds. Outside work I am renovating a tiny terraced house entirely too slowly, and I collect records I do not have space for. My parents came from Pokhara in the nineties. I am not religious but I go to Lhosar every year because the food is non-negotiable.',
    interests: ['architecture', 'records', 'DIY', 'cycling', 'cooking'],
    lookingFor:
      'Someone who has opinions and shares them. I am open about where things might go — I would rather see if we get on first.',
    intent: 'FRIENDSHIP_FIRST',
  },
  {
    email: 'laxmi.tamu@example.com',
    displayName: 'Laxmi',
    gender: 'FEMALE',
    age: 31,
    heightCm: 159,
    clan: 'ghale',
    motherClan: 'neuchhe',
    ancestralDistrict: 'gorkha',
    religion: 'BUDDHIST',
    gurungFluency: 'CONVERSATIONAL',
    languages: ['nepali', 'english', 'gurung'],
    ukRegion: 'oxfordshire',
    city: 'Oxford',
    postcodeArea: 'OX4',
    residencyStatus: 'SETTLED',
    yearsInUk: 6,
    raisedIn: 'NEPAL',
    education: 'MASTERS',
    fieldOfStudy: 'Education',
    occupation: 'Primary school teacher',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K25_40',
    diet: 'OMNIVORE',
    smoking: 'NEVER',
    drinking: 'NEVER',
    familyType: 'JOINT',
    familyValues: 'TRADITIONAL',
    familyBasedIn: 'Gorkha, Nepal',
    brothers: 1,
    sisters: 1,
    headline: 'Teacher in Oxford, Saturday Nepali school volunteer',
    about:
      'I teach Year 3 in Oxford and volunteer at a Saturday Nepali language school, which is the highlight of my week. I moved here six years ago on my own, which my family found alarming and I found necessary. I would like to stay in the UK long term but I am close to home too.',
    interests: ['teaching', 'reading', 'dance', 'baking', 'travel'],
    lookingFor:
      'Someone kind, family-minded and patient. I would like a partner who talks things through rather than going quiet.',
    intent: 'MARRIAGE',
  },
  {
    email: 'santosh.gurung@example.com',
    displayName: 'Santosh',
    gender: 'MALE',
    age: 38,
    heightCm: 171,
    clan: 'pahim',
    motherClan: 'ghale',
    ancestralDistrict: 'nawalparasi',
    religion: 'HINDU',
    gurungFluency: 'CONVERSATIONAL',
    languages: ['nepali', 'english'],
    ukRegion: 'south-wales',
    city: 'Cardiff',
    postcodeArea: 'CF24',
    residencyStatus: 'BRITISH_CITIZEN',
    yearsInUk: 17,
    raisedIn: 'NEPAL',
    education: 'BACHELORS',
    fieldOfStudy: 'Logistics',
    occupation: 'Logistics manager',
    employmentStatus: 'EMPLOYED',
    incomeBand: 'K40_60',
    diet: 'NO_BEEF',
    smoking: 'NEVER',
    drinking: 'OCCASIONALLY',
    familyType: 'NUCLEAR',
    familyValues: 'MODERATE',
    familyBasedIn: 'Cardiff, Wales',
    brothers: 1,
    sisters: 1,
    headline: 'Cardiff-based, rugby convert, quietly good at badminton',
    about:
      'I run a distribution operation just outside Cardiff. Seventeen years in Wales has made me a rugby man, which my Nepali friends find hilarious. I am steady, I own my flat, and I have got to a point where I would like to share it with someone. I play badminton at a club in Roath twice a week.',
    interests: ['badminton', 'rugby', 'cooking', 'walking', 'travel'],
    lookingFor:
      'A settled, good-humoured partner. I am at an age where I know what I want and I would rather be direct about it.',
    intent: 'MARRIAGE',
  },
];

function birthdayFor(age: number, index: number): Date {
  // Spread birthdays across the year so ages aren't all bunched on seed day.
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth((index * 7) % 12);
  d.setDate(((index * 11) % 27) + 1);
  return d;
}

async function main() {
  console.log('Seeding Tamu Sansar…');

  // Start clean so re-running the seed is idempotent.
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@tamusansar.uk',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          displayName: 'Site Admin',
          gender: 'FEMALE',
          dateOfBirth: birthdayFor(40, 1),
          visibility: 'CONNECTIONS_ONLY',
          ukRegion: 'greater-london',
        },
      },
    },
  });
  console.log(`  admin: ${admin.email} / ${PASSWORD}`);

  await prisma.user.create({
    data: {
      email: 'moderator@tamusansar.uk',
      passwordHash,
      role: 'MODERATOR',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          displayName: 'Community Moderator',
          gender: 'MALE',
          dateOfBirth: birthdayFor(45, 2),
          visibility: 'CONNECTIONS_ONLY',
          ukRegion: 'hampshire',
        },
      },
    },
  });

  const created: { id: string; gender: string; name: string }[] = [];

  for (const [index, m] of MEMBERS.entries()) {
    // Stagger last-active times so the "recently active" sort has something to do.
    const lastActiveAt = new Date(Date.now() - index * 7 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email: m.email,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        lastActiveAt,
        createdAt: new Date(Date.now() - (index + 3) * 5 * 24 * 60 * 60 * 1000),
        profile: {
          create: {
            displayName: m.displayName,
            gender: m.gender,
            dateOfBirth: birthdayFor(m.age, index),
            heightCm: m.heightCm,
            maritalStatus: m.maritalStatus ?? 'NEVER_MARRIED',
            clan: m.clan,
            motherClan: m.motherClan ?? null,
            clanGroup: ['ghale', 'ghotane', 'lama', 'lamichhane'].includes(m.clan)
              ? 'CHAR_JAT'
              : 'SOHRA_JAT',
            ancestralDistrict: m.ancestralDistrict,
            religion: m.religion,
            motherTongue: m.languages[0] ?? 'nepali',
            gurungFluency: m.gurungFluency,
            languages: JSON.stringify(m.languages),
            ukRegion: m.ukRegion,
            city: m.city,
            postcodeArea: m.postcodeArea ?? null,
            residencyStatus: m.residencyStatus,
            yearsInUk: m.yearsInUk ?? null,
            raisedIn: m.raisedIn,
            serviceFamily: m.serviceFamily ?? false,
            willingToRelocate: index % 3 === 0,
            education: m.education,
            fieldOfStudy: m.fieldOfStudy ?? null,
            occupation: m.occupation,
            employmentStatus: m.employmentStatus,
            incomeBand: m.incomeBand ?? null,
            diet: m.diet,
            smoking: m.smoking,
            drinking: m.drinking,
            familyType: m.familyType ?? null,
            familyValues: m.familyValues,
            familyBasedIn: m.familyBasedIn ?? null,
            brothers: m.brothers ?? null,
            sisters: m.sisters ?? null,
            headline: m.headline,
            about: m.about,
            interests: JSON.stringify(m.interests),
            lookingFor: m.lookingFor,
            intent: m.intent,
            profileManagedBy: m.profileManagedBy ?? 'SELF',
            verified: m.verified ?? false,
            verifiedAt: m.verified ? new Date() : null,
            // Filled in below once the profile row exists.
            completeness: 0,
            preference: {
              create: {
                ageMin: Math.max(18, m.age - 6),
                ageMax: m.age + 7,
                observeClanExogamy: true,
                gurungHeritageOnly: true,
                intents:
                  m.intent === 'MARRIAGE'
                    ? JSON.stringify(['MARRIAGE'])
                    : JSON.stringify(['SERIOUS_RELATIONSHIP', 'FRIENDSHIP_FIRST', 'MARRIAGE']),
                maxSmoking: m.smoking === 'NEVER' ? 'OCCASIONALLY' : 'SOCIALLY',
                maxDrinking: m.drinking === 'NEVER' ? 'OCCASIONALLY' : 'SOCIALLY',
                maxDistanceMiles: 150,
              },
            },
          },
        },
      },
      include: { profile: true },
    });

    created.push({ id: user.id, gender: m.gender, name: m.displayName });
  }

  // Completeness is normally recomputed on write; do it once here so seeded
  // profiles show a realistic score without a photo upload.
  const { computeCompleteness } = await import('../src/domain/profile.js');
  const profiles = await prisma.profile.findMany({ include: { photos: true } });
  for (const p of profiles) {
    await prisma.profile.update({
      where: { id: p.id },
      data: { completeness: computeCompleteness(p) },
    });
  }

  // A few interests so the inbox, connections and messaging have content.
  const byName = new Map(created.map((c) => [c.name, c.id]));
  const pairs: Array<[string, string, 'PENDING' | 'ACCEPTED']> = [
    ['Bikash', 'Sunita', 'ACCEPTED'],
    ['Anil', 'Sabina', 'ACCEPTED'],
    ['Prakash', 'Maya', 'PENDING'],
    ['Dipesh', 'Anita', 'PENDING'],
    ['Santosh', 'Rekha', 'PENDING'],
    ['Raj', 'Laxmi', 'PENDING'],
    ['Kiran', 'Pooja', 'PENDING'],
  ];

  for (const [senderName, receiverName, status] of pairs) {
    const senderId = byName.get(senderName);
    const receiverId = byName.get(receiverName);
    if (!senderId || !receiverId) continue;

    await prisma.interest.create({
      data: {
        senderId,
        receiverId,
        status,
        message: `Namaste ${receiverName}, I read your profile and would like to get to know you.`,
        respondedAt: status === 'ACCEPTED' ? new Date() : null,
      },
    });

    if (status === 'ACCEPTED') {
      const [memberAId, memberBId] =
        senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId];
      const conversation = await prisma.conversation.create({
        data: { memberAId, memberBId },
      });
      const first = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          body: `Thank you for accepting. How has your week been?`,
        },
      });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: receiverId,
          body: `Busy but good — long shifts. Tell me about where your family is from.`,
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(first.createdAt.getTime() + 60_000),
          lastMessagePreview: 'Busy but good — long shifts. Tell me about where your family is from.',
        },
      });
    }
  }

  // Shortlists and a couple of profile views.
  const sunita = byName.get('Sunita');
  const anita = byName.get('Anita');
  const dipesh = byName.get('Dipesh');
  if (sunita && dipesh) {
    await prisma.shortlist.create({
      data: { ownerId: sunita, targetId: dipesh, note: 'Seems easy to talk to' },
    });
  }
  if (anita && dipesh) {
    await prisma.profileView.create({ data: { viewerId: dipesh, viewedId: anita } });
  }

  const counts = {
    members: await prisma.user.count(),
    profiles: await prisma.profile.count(),
    interests: await prisma.interest.count(),
    conversations: await prisma.conversation.count(),
  };

  console.log('Done:', counts);
  console.log(`\nEvery seeded account uses the password: ${PASSWORD}`);
  console.log('Try signing in as sunita.gurung@example.com or bikash.gurung@example.com');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
