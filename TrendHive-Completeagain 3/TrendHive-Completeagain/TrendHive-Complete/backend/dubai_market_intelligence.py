#!/usr/bin/env python3
"""
==============================================================================
Dubai Cafe Market Intelligence Platform — Analytics & Preprocessing Backend
==============================================================================
GRADUATION PROJECT: AI-Powered Market Intelligence for Cafe Location Decisions
Author: Market Intelligence Pipeline
Date: February 2025
"""

import os, re, sys, json, math, logging, warnings, hashlib
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import Dict, List, Optional, Tuple, Any, Union
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.patches import Patch
from matplotlib.lines import Line2D
import matplotlib.cm as cm
from scipy import stats
from sklearn.preprocessing import MinMaxScaler

warnings.filterwarnings('ignore')
logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-7s | %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger("MarketIntel")

BASE_DATA_DIR = Path("Data/Data_cafe")
TRENDS_DIR = Path("Data/googletrend")
OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

COLORS = {
    'primary':'#2E86AB','secondary':'#A23B72','accent':'#F18F01','success':'#2A9D8F',
    'danger':'#E76F51','dark':'#264653','light':'#E9C46A','bg':'#FAFAFA','grid':'#E0E0E0',
    'palette':['#2E86AB','#A23B72','#F18F01','#2A9D8F','#E76F51','#264653','#E9C46A','#6A4C93','#1982C4','#8AC926'],
}


def load_all_sources(base_dir=BASE_DATA_DIR, trends_dir=TRENDS_DIR):
    log.info("="*70); log.info("STAGE 1: LOADING ALL DATA SOURCES"); log.info("="*70)
    sources = {}
    file_map = {
        'base':'Dubai_cafe.xlsx','price_levels':'dubai_cafes_price_levels.xlsx',
        'competitors':'dubai_cafes_WITH_COMPETITORS_500m.xlsx','reviews':'dubai_cafes_REVIEWS.xlsx',
        'cuisine':'dubai_cafes_PRODUCTION_with_cuisine.xlsx','parking':'dubai_cafes_with_parking.xlsx',
        'pop_density':'dubai_cafes_with_population_density.xlsx','tourist':'dubai_cafes_with_tourist_proxy.xlsx',
        'utility':'dubai_cafes_WITH_UTILITY_DYNAMIC.xlsx','footfall':'dubai_cafes_FINAL_FOOTFALL.xlsx',
        'rent':'dubai_cafes_AUTHENTIC_FULL_RENT.xlsx','rent_ref':'dubai_authentic_commercial_rent.csv',
        'dewa':'dewa_tariffs._utility.csv',
    }
    for name, fname in file_map.items():
        fpath = base_dir / fname
        try:
            sources[name] = pd.read_csv(fpath) if fname.endswith('.csv') else pd.read_excel(fpath)
            log.info(f"  OK {name:20s} -> {sources[name].shape[0]:>4d} rows x {sources[name].shape[1]:>2d} cols")
        except Exception as e:
            log.warning(f"  FAIL {name:20s} -> {e}")
    trends_files = {
        'trend_core_ts':'Core demand/time_series_AE_20210207-1607_20260207-1607.csv',
        'trend_core_top':'Core demand/TopSearch.csv','trend_core_rising':'Core demand/raising_search.csv',
        'trend_premium_ts':'Premium/time_series_AE_20210207-1613_20260207-1613.csv',
        'trend_premium_top':'Premium/topSearchs.csv','trend_premium_rise':'Premium/raisingSearch.csv',
        'trend_general_ts':'trends/time_series_AE_20210207-1616_20260207-1616.csv',
        'trend_general_top':'trends/topsearch.csv','trend_general_rise':'trends/raisingsearch.csv',
    }
    for name, relpath in trends_files.items():
        fpath = trends_dir / relpath
        try:
            sources[name] = pd.read_csv(fpath)
            log.info(f"  OK {name:20s} -> {sources[name].shape[0]:>4d} rows x {sources[name].shape[1]:>2d} cols")
        except Exception as e:
            log.warning(f"  FAIL {name:20s} -> {e}")
    log.info(f"\n  Total sources loaded: {len(sources)}")
    return sources


def detect_schema(sources):
    log.info("="*70); log.info("STAGE 2: SCHEMA DETECTION & VALIDATION"); log.info("="*70)
    FIELD_PATTERNS = {
        'business_name':[r'(?i)^name$',r'(?i)cafe_?name'],
        'address':[r'(?i)address',r'(?i)location$'],
        'rating':[r'(?i)^rating$',r'(?i)overall.*rating',r'(?i)cafe.*rating'],
        'review_count':[r'(?i)reviews?$',r'(?i)review_?count',r'(?i)total.*review'],
        'place_id':[r'(?i)place.?id'],
        'latitude':[r'(?i)lat'], 'longitude':[r'(?i)lon'],
        'price_raw':[r'(?i)^price$',r'(?i)price.*level.*num'],
        'price_label':[r'(?i)price.*label',r'(?i)price.*level.*label'],
        'area':[r'(?i)detected.*area',r'(?i)^area$'],
        'cuisine_primary':[r'(?i)cuisine.*prim'],'cuisine_secondary':[r'(?i)cuisine.*sec'],
        'competitors_500m':[r'(?i)competitor'],
        'tourist_score':[r'(?i)tourist.*score$'],'tourist_index':[r'(?i)tourist.*index'],
        'footfall_score':[r'(?i)footfall'],'population_density':[r'(?i)population.*density'],
        'utility_cost':[r'(?i)utility.*cost'],'rent':[r'(?i)rent.*aed',r'(?i)commercial.*rent'],
        'review_text':[r'(?i)review.*text'],'review_date':[r'(?i)review.*date'],
        'review_rating':[r'(?i)review.*rating'],
    }
    schema_map = {}; found = {}; missing = []
    all_cols = {src: list(df.columns) for src, df in sources.items()}
    for field, patterns in FIELD_PATTERNS.items():
        matched = False
        for src, cols in all_cols.items():
            for col in cols:
                for pat in patterns:
                    if re.search(pat, col):
                        if field not in found:
                            found[field] = (src, col)
                            schema_map[field] = {'source':src, 'column':col}
                        matched = True; break
                if matched: break
            if matched: break
        if not matched: missing.append(field)
    print("\n" + "="*70)
    print("SCHEMA DETECTION REPORT")
    print("="*70)
    print(f"\n{'Field':<25s} {'Source':<22s} {'Column':<35s}")
    print("-"*82)
    for field, info in sorted(schema_map.items()):
        print(f"  [OK] {field:<23s} {info['source']:<22s} {info['column']:<35s}")
    if missing:
        print(f"\n  Missing fields (will skip gracefully):")
        for m in missing: print(f"      X {m}")
    print("="*70)
    return schema_map


def merge_all_sources(sources):
    log.info("="*70); log.info("STAGE 3: MERGING & CLEANING"); log.info("="*70)
    df = sources['base'].copy()
    log.info(f"  Base dataset: {len(df)} cafes")
    merge_configs = [
        ('price_levels',['Name'],['Price','Price_Source','Price_Level_Number','Price_Level_Label']),
        ('competitors',['Name'],['competitors_within_500m']),
        ('cuisine',['Name'],['Cuisine_Primary','Cuisine_Secondary','Cuisine_Confidence','Fusion']),
        ('parking',['Name'],['free_parking_lot','paid_parking_lot','free_street_parking','paid_street_parking','valet_parking']),
        ('pop_density',['Name'],['population_density_people_per_sqkm']),
        ('tourist',['Name'],['hotels_1500m','attractions_1500m','malls_1500m','tourist_score']),
        ('footfall',['Name'],['tourist_index','Footfall_Score']),
        ('utility',['Name'],['utility_cost_aed_month','utility_level']),
        ('rent',['Name'],['detected_area','avg_commercial_rent_aed_sqft_year']),
    ]
    for src_name, on_cols, keep_cols in merge_configs:
        if src_name not in sources: continue
        src_df = sources[src_name].copy()
        avail = [c for c in keep_cols if c in src_df.columns]
        if not avail: continue
        src_df = src_df[on_cols + avail].drop_duplicates(subset=on_cols, keep='first')
        before = len(df)
        df = df.merge(src_df, on=on_cols, how='left', suffixes=('', f'_{src_name}'))
        log.info(f"  Merged {src_name:20s}: +{len(avail)} cols, {len(df)} rows")
    return df

def clean_business_data(df):
    log.info("\n  --- Cleaning Pipeline ---")
    n0 = len(df)
    df = df.drop_duplicates(subset=['Name','Address'], keep='first')
    log.info(f"  Dedup: {n0} -> {len(df)} ({n0-len(df)} removed)")
    price_map = {'PRICE_LEVEL_INEXPENSIVE':1,'PRICE_LEVEL_MODERATE':2,'PRICE_LEVEL_EXPENSIVE':3,'PRICE_LEVEL_VERY_EXPENSIVE':4}
    dollar_map = {'$':1,'$$':2,'$$$':3,'$$$$':4}
    df['price_index'] = np.nan
    
    if 'Price_Level_Number' in df.columns:
        df['price_index'] = df['Price_Level_Number'].map(price_map)
    if 'Price_Level_Label' in df.columns:
        df['price_index'] = df['price_index'].fillna(df['Price_Level_Label'].map(price_map))
    if 'Price' in df.columns:
        df['price_index'] = df['price_index'].fillna(df['Price'].astype(str).str.strip().map(dollar_map))
    df['price_index'] = pd.to_numeric(df['price_index'], errors='coerce')
    log.info(f"  Price index: {df['price_index'].notna().sum()}/{len(df)} have price data")
    if 'Rating' in df.columns: df['Rating'] = pd.to_numeric(df['Rating'], errors='coerce')
    if 'Reviews' in df.columns: df['Reviews'] = pd.to_numeric(df['Reviews'], errors='coerce').fillna(0).astype(int)
    df['name_clean'] = df['Name'].str.strip().str.title()
    if 'detected_area' in df.columns: df['area'] = df['detected_area'].str.strip().str.title()
    else: df['area'] = 'Unknown'
    dubai_areas = ['Downtown Dubai','Jumeirah','Sheikh Zayed Road','DIFC','Difc','Dubai Mall','Al Quoz',
        'Business Bay','Dubai Marina','Oud Metha','Al Wasl','City Walk','Umm Suqeim','Al Barsha',
        'Dubai Design District','Deira','Satwa','Karama','Mirdif','Bur Dubai','JBR','Jbr',
        'International City','Media City','Dubai Silicon Oasis']
    def extract_area(row):
        if pd.notna(row.get('area')) and row['area'] not in ['Unknown','','Nan']: return row['area']
        addr = str(row.get('Address',''))
        for a in dubai_areas:
            if a.lower() in addr.lower(): return a.title()
        return 'Other'
    df['area'] = df.apply(extract_area, axis=1)
    df['area'] = df['area'].replace({'Difc':'DIFC','Jbr':'JBR','Dubai Design District':'D3 Design District'})
    area_med_r = df.groupby('area')['Rating'].transform('median')
    df['Rating'] = df['Rating'].fillna(area_med_r).fillna(df['Rating'].median())
    area_med_p = df.groupby('area')['price_index'].transform('median')
    df['price_index'] = df['price_index'].fillna(area_med_p).fillna(2.0)
    for col in ['competitors_within_500m','hotels_1500m','attractions_1500m','malls_1500m',
                'tourist_score','tourist_index','Footfall_Score','population_density_people_per_sqkm',
                'utility_cost_aed_month','avg_commercial_rent_aed_sqft_year']:
        if col in df.columns: df[col] = pd.to_numeric(df[col], errors='coerce')
    log.info(f"  Currency: AED (from rent/utility cols)")
    log.info(f"  Final cleaned: {df.shape}")
    return df

def engineer_business_features(df):
    log.info("="*70); log.info("STAGE 4: FEATURE ENGINEERING"); log.info("="*70)
    area_med_rev = df.groupby('area')['Reviews'].transform('median')
    df['review_density'] = np.where(area_med_rev > 0, df['Reviews']/area_med_rev, 0)
    area_mean_p = df.groupby('area')['price_index'].transform('mean')
    df['price_position_index'] = np.where(area_mean_p > 0, df['price_index']/area_mean_p, 1.0)
    area_mean_r = df.groupby('area')['Rating'].transform('mean')
    area_std_r = df.groupby('area')['Rating'].transform('std').replace(0, 1)
    df['rating_zscore'] = ((df['Rating'] - area_mean_r) / area_std_r).fillna(0)
    if 'competitors_within_500m' in df.columns:
        comp = df['competitors_within_500m'].fillna(1).clip(lower=1)
        df['engagement_proxy'] = df['Reviews'] / comp
    else:
        df['engagement_proxy'] = df['Reviews']
    pcols = ['free_parking_lot','paid_parking_lot','free_street_parking','paid_street_parking','valet_parking']
    ap = [c for c in pcols if c in df.columns]
    df['parking_score'] = df[ap].fillna(0).sum(axis=1) if ap else 0
    df['has_valet'] = df.get('valet_parking', pd.Series(0, index=df.index)).fillna(0).astype(int)
    if 'Footfall_Score' in df.columns and 'tourist_index' in df.columns:
        ff = df['Footfall_Score'].fillna(0); ti = df['tourist_index'].fillna(0)
        ff_n = (ff-ff.min())/(ff.max()-ff.min()+1e-9); ti_n = (ti-ti.min())/(ti.max()-ti.min()+1e-9)
        df['location_attractiveness'] = 0.5*ff_n + 0.5*ti_n
    else:
        df['location_attractiveness'] = 0.5
    if 'avg_commercial_rent_aed_sqft_year' in df.columns:
        rent = df['avg_commercial_rent_aed_sqft_year'].fillna(df['avg_commercial_rent_aed_sqft_year'].median())
        df['rent_normalized'] = (rent-rent.min())/(rent.max()-rent.min()+1e-9)
    else:
        df['rent_normalized'] = 0.5
    df['is_premium'] = (df['price_index'] >= 3).astype(int)
    df['is_budget'] = (df['price_index'] <= 1).astype(int)
    log.info(f"  Features engineered: {df.shape[1]} columns total")
    return df


POSITIVE_WORDS = set("amazing awesome beautiful best brilliant calm charming clean cozy comfortable creative crispy decent delicious delightful divine elegant excellent exceptional exquisite fabulous fantastic favorite fine flavorful fluffy fragrant fresh friendly fulfilling generous genuine glorious good gorgeous gracious great happy hearty heavenly helpful honest incredible inviting irresistible juicy kind legendary lively love lovely luxurious magnificent marvelous memorable modern neat nice outstanding paradise peaceful perfect phenomenal pleasant polite premium professional pure quality recommended refined refreshing relaxing remarkable rich romantic satisfied savory scrumptious sensational smooth sophisticated sparkling special spectacular splendid stellar stunning sublime succulent superb superior supreme sweet tasty tender terrific thoughtful tremendous unforgettable unique vibrant warm welcoming wholesome wonderful yummy".split())
NEGATIVE_WORDS = set("abysmal annoying appalling atrocious awful bad bitter bland boring broken burnt cheap cold confusing crowded dangerous dark dated depressing dirty disappointing disgusting disorganized dreadful dry dull dusty expensive faded filthy flavorless freezing greasy grim gross horrible horrid icy ignorant impolite inadequate inedible inferior irritating lackluster mediocre messy moldy nasty neglected noisy obnoxious offensive old overcooked overpriced pathetic pitiful plain poor rancid raw revolting rotten rude salty shabby shady shameful shoddy sick slippery slow sloppy smelly soggy sour spoiled stale stingy stressful subpar tasteless terrible thick thin tired tough ugly unacceptable undercooked unfriendly unpleasant unsanitary unwelcoming vile vulgar watery weak worse worst".split())
INTENSIFIERS = {'very':1.5,'really':1.4,'extremely':1.8,'absolutely':1.7,'incredibly':1.6,'highly':1.5,'super':1.4,'so':1.3,'too':1.3,'most':1.4,'totally':1.4,'truly':1.5}
NEGATORS = {'not','no','never','neither','nor','hardly','barely',"don't","doesn't","didn't","won't","wouldn't","couldn't","shouldn't","isn't","aren't","wasn't","weren't"}

def lightweight_sentiment(text):
    if not isinstance(text, str) or len(text.strip()) < 3: return 0.0
    words = re.findall(r"[\w'-]+", text.lower())
    if not words: return 0.0
    score = 0.0; count = 0
    for i, w in enumerate(words):
        val = 0.0
        if w in POSITIVE_WORDS: val = 1.0
        elif w in NEGATIVE_WORDS: val = -1.0
        else: continue
        for j in range(max(0,i-2),i):
            if words[j] in INTENSIFIERS: val *= INTENSIFIERS[words[j]]; break
        for j in range(max(0,i-3),i):
            if words[j] in NEGATORS: val *= -0.75; break
        score += val; count += 1
    if count == 0:
        if any(w in text.lower() for w in ['5 star','5/5','10/10']): return 0.8
        elif any(w in text.lower() for w in ['1 star','1/5','0/10']): return -0.8
        return 0.0
    return max(-1.0, min(1.0, score/count))

def compute_sentiment_features(df_biz, df_reviews):
    log.info("="*70); log.info("STAGE 5: SENTIMENT ANALYSIS"); log.info("="*70)
    if df_reviews is None or 'Review_Text' not in df_reviews.columns:
        log.warning("  No review text -> skipping sentiment")
        df_biz['sentiment_mean']=0.0; df_biz['sentiment_std']=0.0; df_biz['positive_ratio']=0.5
        return df_biz, pd.DataFrame()
    reviews = df_reviews.copy()
    log.info("  Computing sentiment scores...")
    reviews['sentiment_score'] = reviews['Review_Text'].fillna('').apply(lightweight_sentiment)
    if 'Review_Rating' in reviews.columns:
        star_sent = (reviews['Review_Rating'].fillna(3)-3)/2
        reviews['sentiment_blended'] = np.where(
            reviews['Review_Text'].fillna('').str.len()>20,
            0.6*reviews['sentiment_score']+0.4*star_sent, star_sent)
    else:
        reviews['sentiment_blended'] = reviews['sentiment_score']
    reviews['sentiment_label'] = pd.cut(reviews['sentiment_blended'], bins=[-1.01,-0.2,0.2,1.01], labels=['negative','neutral','positive'])
    dist = reviews['sentiment_label'].value_counts()
    for label, count in dist.items():
        log.info(f"    {label}: {count} ({100*count/len(reviews):.1f}%)")
    join_col = 'Place_ID' if 'Place_ID' in reviews.columns else 'Cafe_Name'
    biz_col = 'Place_ID' if 'Place_ID' in df_biz.columns else 'Name'
    biz_sent = reviews.groupby(join_col).agg(
        sentiment_mean=('sentiment_blended','mean'), sentiment_std=('sentiment_blended','std'),
        positive_ratio=('sentiment_label', lambda x: (x=='positive').mean()),
        negative_ratio=('sentiment_label', lambda x: (x=='negative').mean()),
        review_count_analyzed=('sentiment_blended','count'),
    ).reset_index()
    biz_sent['sentiment_std'] = biz_sent['sentiment_std'].fillna(0)
    df_biz = df_biz.merge(biz_sent, left_on=biz_col, right_on=join_col, how='left', suffixes=('','_sent'))
    df_biz['sentiment_mean'] = df_biz['sentiment_mean'].fillna(0.0)
    df_biz['sentiment_std'] = df_biz['sentiment_std'].fillna(0.0)
    df_biz['positive_ratio'] = df_biz['positive_ratio'].fillna(0.5)
    df_biz['negative_ratio'] = df_biz.get('negative_ratio', pd.Series(0.1)).fillna(0.1)
    log.info(f"  Sentiment features merged: {biz_sent.shape[0]} businesses")
    return df_biz, reviews


def extract_trends(sources):
    log.info("="*70); log.info("STAGE 6: TREND & GROWTH EXTRACTION"); log.info("="*70)
    trends = {}
    ts_keys = [('trend_core_ts','Core Demand'),('trend_premium_ts','Premium Segment'),('trend_general_ts','General Trends')]
    for key, label in ts_keys:
        if key not in sources: continue
        ts = sources[key].copy()
        if 'Time' in ts.columns: ts['Time'] = pd.to_datetime(ts['Time']); ts = ts.set_index('Time')
        trend_info = {}
        for col in ts.columns:
            vals = pd.to_numeric(ts[col], errors='coerce').dropna()
            if len(vals) < 6: continue
            x = np.arange(len(vals))
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, vals.values)
            first_half = vals.iloc[:len(vals)//2].mean(); second_half = vals.iloc[len(vals)//2:].mean()
            growth_pct = ((second_half-first_half)/(first_half+1e-9))*100
            classification = 'GROWING' if growth_pct>20 and slope>0 else ('DECLINING' if growth_pct<-15 else 'STABLE')
            trend_info[col] = {'slope':round(slope,4),'r_squared':round(r_value**2,4),'growth_pct':round(growth_pct,1),
                'classification':classification,'latest_value':int(vals.iloc[-1]),'mean_value':round(vals.mean(),1)}
            log.info(f"  {label}/{col}: {classification} (growth={growth_pct:.1f}%)")
        trends[label] = trend_info
    for kp, lbl in [('trend_core','Core'),('trend_premium','Premium'),('trend_general','General')]:
        for suf, sl in [('_top','top_searches'),('_rise','rising_searches'),('_rising','rising_searches')]:
            k = kp+suf
            if k in sources and 'query' in sources[k].columns:
                if lbl not in trends: trends[lbl] = {}
                trends[lbl][sl] = sources[k]['query'].head(10).tolist()
    log.info("  Google Trends = UAE-level (not per-area); per-area growth from reviews.")
    return trends

def compute_review_growth(df_reviews, df_biz):
    log.info("\n  Computing review-based growth signals...")
    if df_reviews is None or 'Review_Date' not in df_reviews.columns:
        log.warning("  No review dates -> skipping growth"); df_biz['growth_class']='UNKNOWN'; df_biz['review_momentum']=0.0; return df_biz
    reviews = df_reviews.copy(); ref_date = datetime(2025,2,7)
    def parse_rel(s):
        if not isinstance(s, str): return pd.NaT
        s = s.lower().strip()
        m = re.match(r'(\d+)\s+(day|week|month|year)s?\s+ago', s)
        if m:
            n=int(m.group(1)); u=m.group(2)
            if u=='day': return ref_date-timedelta(days=n)
            elif u=='week': return ref_date-timedelta(weeks=n)
            elif u=='month': return ref_date-timedelta(days=n*30)
            elif u=='year': return ref_date-timedelta(days=n*365)
        if 'a week ago' in s: return ref_date-timedelta(weeks=1)
        if 'a month ago' in s: return ref_date-timedelta(days=30)
        if 'a year ago' in s: return ref_date-timedelta(days=365)
        return pd.NaT
    reviews['review_datetime'] = reviews['Review_Date'].apply(parse_rel)
    valid = reviews['review_datetime'].notna().sum()
    log.info(f"  Parsed {valid}/{len(reviews)} review dates")
    if valid < 10: df_biz['growth_class']='UNKNOWN'; df_biz['review_momentum']=0.0; return df_biz
    cutoff = ref_date-timedelta(days=180)
    jc = 'Place_ID' if 'Place_ID' in reviews.columns else 'Cafe_Name'
    bc = 'Place_ID' if 'Place_ID' in df_biz.columns else 'Name'
    recent = reviews[reviews['review_datetime']>=cutoff].groupby(jc).size()
    older = reviews[reviews['review_datetime']<cutoff].groupby(jc).size()
    mom = pd.DataFrame({'recent_reviews':recent,'older_reviews':older}).fillna(0)
    mom['review_momentum'] = np.where(mom['older_reviews']>0, mom['recent_reviews']/mom['older_reviews'], np.where(mom['recent_reviews']>0,2.0,0.0))
    mom['growth_class'] = pd.cut(mom['review_momentum'], bins=[-np.inf,0.5,1.2,np.inf], labels=['DECLINING','STABLE','GROWING'])
    mom = mom.reset_index()
    df_biz = df_biz.merge(mom[[jc,'review_momentum','growth_class']], left_on=bc, right_on=jc, how='left', suffixes=('','_growth'))
    df_biz['review_momentum'] = df_biz['review_momentum'].fillna(1.0)
    df_biz['growth_class'] = df_biz['growth_class'].fillna('STABLE')
    for cls, cnt in df_biz['growth_class'].value_counts().items(): log.info(f"    {cls}: {cnt}")
    return df_biz

def compute_competition_metrics(df):
    log.info("="*70); log.info("STAGE 7: COMPETITION & SATURATION METRICS"); log.info("="*70)
    agg_dict = {
        'total_cafes':('Name','count'), 'avg_rating':('Rating','mean'), 'median_rating':('Rating','median'),
        'std_rating':('Rating','std'), 'avg_reviews':('Reviews','mean'), 'total_reviews':('Reviews','sum'),
        'avg_price':('price_index','mean'), 'median_price':('price_index','median'),
        'premium_count':('is_premium','sum'), 'budget_count':('is_budget','sum'),
        'avg_sentiment':('sentiment_mean','mean'), 'avg_positive_ratio':('positive_ratio','mean'),
        'avg_parking':('parking_score','mean'), 'avg_engagement':('engagement_proxy','mean'),
        'avg_location_attract':('location_attractiveness','mean'),
    }
    optional = {
        'avg_competitors_500m':('competitors_within_500m','mean'),
        'avg_footfall':('Footfall_Score','mean'), 'avg_tourist_index':('tourist_index','mean'),
        'avg_pop_density':('population_density_people_per_sqkm','mean'),
        'avg_rent':('avg_commercial_rent_aed_sqft_year','mean'),
        'avg_utility_cost':('utility_cost_aed_month','mean'),
    }
    for k,(col,fn) in optional.items():
        if col in df.columns: agg_dict[k] = (col, fn)
    am = df.groupby('area').agg(**agg_dict).reset_index()
    for col in ['avg_competitors_500m','avg_footfall','avg_tourist_index','avg_pop_density','avg_rent','avg_utility_cost']:
        if col not in am.columns: am[col] = 0
    am['premium_vs_budget_ratio'] = np.where(am['budget_count']>0, am['premium_count']/am['budget_count'], am['premium_count'])
    tr_all = am['total_reviews'].sum()
    am['review_share'] = am['total_reviews']/(tr_all+1)
    am['cafe_share'] = am['total_cafes']/am['total_cafes'].sum()
    am['saturation_index'] = np.where(am['review_share']>0, am['cafe_share']/am['review_share'], 1.0)
    comp_max = am['avg_competitors_500m'].max()
    am['competitor_density_norm'] = am['avg_competitors_500m']/(comp_max+1e-9) if comp_max>0 else 0.5
    log.info(f"  Competition metrics: {len(am)} areas")
    return am


def compute_area_performance(am, df_biz):
    log.info("="*70); log.info("STAGE 8: AREA PERFORMANCE ANALYTICS"); log.info("="*70)
    def norm01(s):
        s = pd.to_numeric(s, errors='coerce').fillna(0)
        mn, mx = s.min(), s.max()
        return pd.Series(0.5, index=s.index) if mx-mn<1e-9 else (s-mn)/(mx-mn)
    am['demand_score'] = 0.40*norm01(am['total_reviews'])+0.30*norm01(am['avg_footfall'])+0.20*norm01(am['avg_pop_density'])+0.10*norm01(am['avg_tourist_index'])
    am['competition_intensity'] = 0.40*norm01(am['total_cafes'])+0.35*norm01(am['competitor_density_norm'])+0.25*norm01(am['saturation_index'])
    am['price_level_index'] = norm01(am['avg_price'])
    am['reputation_strength'] = 0.40*norm01(am['avg_rating'])+0.35*norm01(am['avg_sentiment'])+0.25*norm01(am['avg_positive_ratio'])
    ag = df_biz.groupby('area').agg(pct_growing=('growth_class', lambda x: (x=='GROWING').mean()), avg_momentum=('review_momentum','mean')).reset_index()
    am = am.merge(ag, on='area', how='left')
    am['pct_growing'] = am['pct_growing'].fillna(0.5); am['avg_momentum'] = am['avg_momentum'].fillna(1.0)
    am['growth_momentum'] = 0.50*norm01(am['pct_growing'])+0.50*norm01(am['avg_momentum'])
    am['market_balance'] = 0.35*am['demand_score']+0.25*(1-am['competition_intensity'])+0.20*am['reputation_strength']+0.20*am['growth_momentum']
    am['barrier_to_entry'] = 0.60*norm01(am['avg_rent'])+0.40*norm01(am['avg_utility_cost'])
    def classify(r):
        if r['competition_intensity']>0.7 and r['demand_score']>0.6: return 'Saturated High-Demand'
        elif r['competition_intensity']>0.6 and r['price_level_index']>0.65: return 'Premium-Heavy'
        elif r['competition_intensity']<0.35 and r['demand_score']>0.3: return 'Emerging Opportunity'
        elif r['competition_intensity']<0.3 and r['demand_score']<0.25: return 'Underserved / Niche'
        elif r['growth_momentum']>0.65: return 'High-Growth Corridor'
        elif r['competition_intensity']>0.5 and r['demand_score']<0.35: return 'Oversaturated'
        else: return 'Balanced Market'
    am['market_positioning'] = am.apply(classify, axis=1)
    def strengths(r):
        s = []
        if r['demand_score']>0.6: s.append("High consumer demand")
        if r['reputation_strength']>0.65: s.append("Strong area reputation")
        if r['growth_momentum']>0.6: s.append("Growing market momentum")
        if r['avg_footfall']>25: s.append("High foot traffic zone")
        if r['avg_tourist_index']>60: s.append("Tourist-heavy traffic")
        if r['barrier_to_entry']<0.35: s.append("Lower operational costs")
        if r['avg_parking']>2: s.append("Good parking availability")
        return "; ".join(s) if s else "Moderate across metrics"
    def risks(r):
        s = []
        if r['competition_intensity']>0.65: s.append("High competition density")
        if r['saturation_index']>1.3: s.append("Market oversaturation risk")
        if r['barrier_to_entry']>0.7: s.append("High rent & utility costs")
        if r['avg_rating']<4.0: s.append("Below-average area reputation")
        if r['avg_sentiment']<0.1: s.append("Mixed/low customer sentiment")
        if r['growth_momentum']<0.35: s.append("Stagnant/declining momentum")
        if r['premium_vs_budget_ratio']>3: s.append("Premium-skewed")
        return "; ".join(s) if s else "Relatively low risk profile"
    am['strengths'] = am.apply(strengths, axis=1); am['risks'] = am.apply(risks, axis=1)
    log.info(f"  Area performance computed. Positioning:")
    for p, c in am['market_positioning'].value_counts().items(): log.info(f"    {p}: {c}")
    return am


def compute_category_metrics(df_biz):
    log.info("="*70); log.info("STAGE 8b: CATEGORY-LEVEL METRICS"); log.info("="*70)
    if 'Cuisine_Primary' not in df_biz.columns: log.warning("  No cuisine data"); return pd.DataFrame()
    agg = {'count':('Name','count'),'avg_rating':('Rating','mean'),'avg_reviews':('Reviews','mean'),
        'total_reviews':('Reviews','sum'),'avg_price':('price_index','mean'),'avg_sentiment':('sentiment_mean','mean'),
        'avg_engagement':('engagement_proxy','mean'),'pct_premium':('is_premium','mean'),'num_areas':('area','nunique')}
    if 'competitors_within_500m' in df_biz.columns: agg['avg_competitors']=('competitors_within_500m','mean')
    cat = df_biz.groupby('Cuisine_Primary').agg(**agg).reset_index()
    cat = cat.rename(columns={'Cuisine_Primary':'cuisine'})
    cat['market_share'] = cat['total_reviews']/(cat['total_reviews'].sum()+1)
    cat = cat.sort_values('count', ascending=False)
    log.info(f"  Category metrics: {len(cat)} cuisines")
    return cat

class OpportunityScorer:
    """Flexible opportunity scoring engine. NOT a simple ranker -- produces per-area
    opportunity breakdowns with explanations tailored to user priorities."""
    PROFILES = {
        'budget_cautious': {
            'label':'Budget-Conscious, Low-Competition Seeker',
            'weights':{'demand_score':0.20,'competition_intensity':-0.30,'price_level_index':-0.15,
                'reputation_strength':0.10,'growth_momentum':0.10,'barrier_to_entry':-0.15},
            'description':'Affordable areas with low competition and manageable startup costs.',
        },
        'premium_concept': {
            'label':'Premium Concept in High-Demand Area',
            'weights':{'demand_score':0.30,'competition_intensity':-0.10,'price_level_index':0.15,
                'reputation_strength':0.20,'growth_momentum':0.15,'barrier_to_entry':-0.10},
            'description':'High-end concept thriving in prestigious, high-foot-traffic areas.',
        },
        'growth_hunter': {
            'label':'Trend-Driven High-Growth Seeker',
            'weights':{'demand_score':0.15,'competition_intensity':-0.15,'price_level_index':0.00,
                'reputation_strength':0.15,'growth_momentum':0.35,'barrier_to_entry':-0.20},
            'description':'Emerging areas with strong growth trajectory and room to grow.',
        },
        'balanced_investor': {
            'label':'Balanced Risk-Return Investor',
            'weights':{'demand_score':0.25,'competition_intensity':-0.20,'price_level_index':0.00,
                'reputation_strength':0.20,'growth_momentum':0.20,'barrier_to_entry':-0.15},
            'description':'Well-rounded opportunity with moderate risk.',
        },
        'tourist_focused': {
            'label':'Tourist-Traffic Focused Concept',
            'weights':{'demand_score':0.25,'competition_intensity':-0.05,'price_level_index':0.10,
                'reputation_strength':0.15,'growth_momentum':0.10,'barrier_to_entry':-0.10},
            'extra_boost':{'avg_tourist_index':0.25},
            'description':'Targeting tourists and visitors; foot traffic is king.',
        },
    }
    def __init__(self, area_metrics):
        self.area_metrics = area_metrics.copy()
        dims = ['demand_score','competition_intensity','price_level_index','reputation_strength','growth_momentum','barrier_to_entry']
        self.norm_data = self.area_metrics[['area']+dims].copy()
        for col in dims:
            s = self.norm_data[col]; mn,mx = s.min(),s.max()
            self.norm_data[col] = (s-mn)/(mx-mn) if mx-mn>1e-9 else 0.5

    def score(self, profile):
        if isinstance(profile, str):
            if profile not in self.PROFILES: raise ValueError(f"Unknown profile: {profile}")
            pconf = self.PROFILES[profile]
        else: pconf = profile
        weights = pconf['weights']; label = pconf.get('label','Custom')
        result = self.norm_data.copy(); result['opportunity_score'] = 0.0
        for dim, w in weights.items():
            if dim in result.columns: result['opportunity_score'] += result[dim]*w
        if 'extra_boost' in pconf:
            for raw_col, bw in pconf['extra_boost'].items():
                if raw_col in self.area_metrics.columns:
                    v = self.area_metrics[raw_col]; mn,mx=v.min(),v.max()
                    normed = (v-mn)/(mx-mn) if mx-mn>1e-9 else 0.5
                    result['opportunity_score'] += normed.values*bw
        s = result['opportunity_score']; mn,mx=s.min(),s.max()
        result['opportunity_score'] = ((s-mn)/(mx-mn))*100 if mx-mn>1e-9 else 50.0
        result = result.merge(self.area_metrics[['area','market_positioning','strengths','risks','total_cafes','avg_rating','avg_rent']], on='area', how='left')
        def explain(row):
            parts = [f"Score: {row['opportunity_score']:.1f}/100 for '{label}'"]
            pos = sorted([(d,w,row.get(d,0)*w) for d,w in weights.items() if w>0 and d in row.index], key=lambda x:x[2], reverse=True)
            neg = sorted([(d,w,row.get(d,0)*abs(w)) for d,w in weights.items() if w<0 and d in row.index], key=lambda x:x[2], reverse=True)
            if pos: parts.append(f"Top advantage: {pos[0][0].replace('_',' ').title()} ({row.get(pos[0][0],0):.2f})")
            if neg: parts.append(f"Top concern: {neg[0][0].replace('_',' ').title()} ({row.get(neg[0][0],0):.2f})")
            parts.append(f"Market: {row.get('market_positioning','N/A')}")
            return " | ".join(parts)
        result['explanation'] = result.apply(explain, axis=1)
        return result.sort_values('opportunity_score', ascending=False)

    def recommend_areas(self, user_profile_dict):
        """Returns ALL areas ranked by match quality with per-dimension breakdown + explanation."""
        return self.score(user_profile_dict)

def build_opportunity_metrics(area_metrics):
    log.info("="*70); log.info("STAGE 9: OPPORTUNITY SCORING FRAMEWORK"); log.info("="*70)
    scorer = OpportunityScorer(area_metrics)
    all_opps = []
    for pn, pc in OpportunityScorer.PROFILES.items():
        scored = scorer.score(pn); scored['profile'] = pn; scored['profile_label'] = pc['label']
        all_opps.append(scored)
        log.info(f"  Scored: {pc['label']}")
        for _, row in scored.head(3).iterrows(): log.info(f"      {row['area']} -> {row['opportunity_score']:.1f}/100")
    return pd.concat(all_opps, ignore_index=True), scorer

def generate_charts(area_metrics, df_biz, cat_metrics, opp_df, trends, reviews_sent, output_dir=OUTPUT_DIR):
    log.info("="*70); log.info("STAGE 10: CHART GENERATION"); log.info("="*70)
    cd = output_dir/"charts"; cd.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({'font.size':11,'axes.titlesize':14,'axes.labelsize':12,'figure.facecolor':COLORS['bg'],'axes.facecolor':'white','axes.grid':True,'grid.alpha':0.3,'grid.color':COLORS['grid']})
    am = area_metrics.sort_values('total_cafes', ascending=False).head(20)

   
    fig, ax = plt.subplots(figsize=(12,8))
    sc = ax.scatter(am['competition_intensity'], am['demand_score'], s=am['total_cafes']*15, c=am['reputation_strength'], cmap='RdYlGn', alpha=0.8, edgecolors=COLORS['dark'], linewidth=0.8)
    for _, r in am.iterrows(): ax.annotate(r['area'], (r['competition_intensity'],r['demand_score']), fontsize=8, ha='center', va='bottom', xytext=(0,8), textcoords='offset points', fontweight='bold')
    plt.colorbar(sc, label='Reputation Strength', shrink=0.8)
    ax.set_xlabel('Competition Intensity', fontweight='bold'); ax.set_ylabel('Demand Score', fontweight='bold')
    ax.set_title('Dubai Cafe Market: Demand vs Competition\n(Size=# cafes, Color=Reputation)', fontweight='bold', pad=15)
    ax.axhline(y=0.5, color=COLORS['grid'], ls='--', alpha=0.5); ax.axvline(x=0.5, color=COLORS['grid'], ls='--', alpha=0.5)
    ax.text(0.22,0.88,'Sweet Spot',transform=ax.transAxes,fontsize=9,ha='center',color=COLORS['success'],fontstyle='italic')
    ax.text(0.78,0.88,'Saturated',transform=ax.transAxes,fontsize=9,ha='center',color=COLORS['danger'],fontstyle='italic')
    ax.text(0.22,0.06,'Underserved',transform=ax.transAxes,fontsize=9,ha='center',color=COLORS['accent'],fontstyle='italic')
    ax.text(0.78,0.06,'Avoid',transform=ax.transAxes,fontsize=9,ha='center',color='gray',fontstyle='italic')
    fig.tight_layout(); fig.savefig(cd/'01_demand_vs_competition.png', dpi=150, bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 1: Demand vs Competition")

    
    fig, ax = plt.subplots(figsize=(12,8))
    sc2 = ax.scatter(am['avg_price'], am['avg_reviews'], s=am['total_cafes']*15, c=am['avg_rating'], cmap='viridis', alpha=0.8, edgecolors=COLORS['dark'], linewidth=0.8)
    for _, r in am.iterrows(): ax.annotate(r['area'], (r['avg_price'],r['avg_reviews']), fontsize=8, ha='center', va='bottom', xytext=(0,8), textcoords='offset points', fontweight='bold')
    plt.colorbar(sc2, label='Average Rating', shrink=0.8)
    ax.set_xlabel('Average Price Level', fontweight='bold'); ax.set_ylabel('Avg Reviews per Cafe', fontweight='bold')
    ax.set_title('Price Positioning vs Popularity\n(Size=# cafes, Color=Rating)', fontweight='bold', pad=15)
    fig.tight_layout(); fig.savefig(cd/'02_price_vs_popularity.png', dpi=150, bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 2: Price vs Popularity")

    
    fig, ax = plt.subplots(figsize=(14,7))
    ams = am.sort_values('total_cafes', ascending=True)
    cols_bar = [COLORS['danger'] if x>am['total_cafes'].median() else COLORS['success'] for x in ams['total_cafes']]
    ax.barh(ams['area'], ams['total_cafes'], color=cols_bar, edgecolor='white', linewidth=0.5)
    if 'avg_competitors_500m' in ams.columns:
        ax2 = ax.twiny(); ax2.plot(ams['avg_competitors_500m'], ams['area'], 'D-', color=COLORS['accent'], ms=6, lw=1.5, alpha=0.8)
        ax2.set_xlabel('Avg Competitors 500m', color=COLORS['accent'], fontweight='bold')
    ax.set_xlabel('Number of Cafes', fontweight='bold'); ax.set_title('Competition Density by Area', fontweight='bold', pad=15)
    ax.legend(handles=[Patch(fc=COLORS['danger'],label='Above median'),Patch(fc=COLORS['success'],label='Below median')], loc='lower right')
    fig.tight_layout(); fig.savefig(cd/'03_competition_density.png', dpi=150, bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 3: Competition Density")

    
    fig, ax = plt.subplots(figsize=(14,7))
    ams2 = am.sort_values('avg_sentiment', ascending=True)
    bcols = [COLORS['success'] if x>0.3 else COLORS['accent'] if x>0.1 else COLORS['danger'] for x in ams2['avg_sentiment']]
    ax.barh(ams2['area'], ams2['avg_sentiment'], color=bcols, edgecolor='white', linewidth=0.5)
    ax.axvline(x=am['avg_sentiment'].mean(), color=COLORS['dark'], ls='--', alpha=0.6, label=f"Avg: {am['avg_sentiment'].mean():.2f}")
    ax.set_xlabel('Average Sentiment Score', fontweight='bold'); ax.set_title('Customer Sentiment by Area', fontweight='bold', pad=15); ax.legend()
    fig.tight_layout(); fig.savefig(cd/'04_sentiment_by_area.png', dpi=150, bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 4: Sentiment by Area")

    
    dims = ['demand_score','competition_intensity','price_level_index','reputation_strength','growth_momentum','barrier_to_entry']
    angles = np.linspace(0,2*np.pi,len(dims),endpoint=False).tolist(); angles += angles[:1]
    fig, ax = plt.subplots(figsize=(10,10), subplot_kw=dict(polar=True))
    for i, (_, r) in enumerate(am.head(6).iterrows()):
        vals = [r.get(d,0) for d in dims]+[r.get(dims[0],0)]
        c = COLORS['palette'][i%len(COLORS['palette'])]
        ax.plot(angles, vals, 'o-', lw=2, label=r['area'], color=c); ax.fill(angles, vals, alpha=0.1, color=c)
    ax.set_xticks(angles[:-1]); ax.set_xticklabels([d.replace('_','\n').title() for d in dims], fontsize=9)
    ax.set_ylim(0,1); ax.set_title('Area Opportunity Radar - Top 6 by Demand', fontweight='bold', pad=25)
    ax.legend(loc='upper right', bbox_to_anchor=(1.3,1.1), fontsize=9)
    fig.tight_layout(); fig.savefig(cd/'05_opportunity_radar.png', dpi=150, bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 5: Opportunity Radar")

    
    fig, ax = plt.subplots(figsize=(12,8))
    pc = {'Saturated High-Demand':COLORS['danger'],'Premium-Heavy':COLORS['secondary'],'Emerging Opportunity':COLORS['success'],
        'Underserved / Niche':COLORS['accent'],'High-Growth Corridor':COLORS['primary'],'Oversaturated':'#999','Balanced Market':COLORS['dark']}
    for pos, grp in area_metrics.groupby('market_positioning'):
        ax.scatter(grp['competition_intensity'], grp['growth_momentum'], s=grp['total_cafes']*18, c=pc.get(pos,'#888'), label=pos, alpha=0.75, edgecolors='white', lw=1)
        for _, r in grp.iterrows(): ax.annotate(r['area'], (r['competition_intensity'],r['growth_momentum']), fontsize=7, ha='center', va='bottom', xytext=(0,6), textcoords='offset points')
    ax.set_xlabel('Competition Intensity', fontweight='bold'); ax.set_ylabel('Growth Momentum', fontweight='bold')
    ax.set_title('Market Positioning Map (Size=# cafes)', fontweight='bold', pad=15); ax.legend(loc='upper left', fontsize=8)
    fig.tight_layout(); fig.savefig(cd/'06_market_positioning_map.png', dpi=150, bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 6: Market Positioning Map")

    
    fig, axes = plt.subplots(1,3, figsize=(18,5))
    ts_map = {0:('Data/googletrend/Core demand/time_series_AE_20210207-1607_20260207-1607.csv','Core Demand'),
        1:('Data/googletrend/Premium/time_series_AE_20210207-1613_20260207-1613.csv','Premium Segment'),
        2:('Data/googletrend/trends/time_series_AE_20210207-1616_20260207-1616.csv','Trending Beverages')}
    for ai,(fp,lbl) in ts_map.items():
        try:
            tdf = pd.read_csv(fp); tdf['Time']=pd.to_datetime(tdf['Time']); ax=axes[ai]
            for j,col in enumerate([c for c in tdf.columns if c!='Time']):
                ax.plot(tdf['Time'],tdf[col],lw=2,color=COLORS['palette'][j],label=col,marker='o',ms=2)
            ax.set_title(lbl, fontweight='bold'); ax.legend(fontsize=8); ax.tick_params(axis='x',rotation=45)
        except: pass
    fig.suptitle('Google Trends - UAE Cafe Market Demand (2021-2026)', fontweight='bold', fontsize=14, y=1.02)
    fig.tight_layout(); fig.savefig(cd/'07_google_trends.png', dpi=150, bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 7: Google Trends")

    
    fig, ax = plt.subplots(figsize=(16,10))
    sc_cols = ['demand_score','competition_intensity','price_level_index','reputation_strength','growth_momentum','barrier_to_entry','market_balance']
    hd = area_metrics.set_index('area')[sc_cols].sort_values('market_balance', ascending=False)
    im = ax.imshow(hd.values, cmap='RdYlGn', aspect='auto', vmin=0, vmax=1)
    ax.set_xticks(range(len(sc_cols))); ax.set_xticklabels([c.replace('_','\n').title() for c in sc_cols], fontsize=9, fontweight='bold')
    ax.set_yticks(range(len(hd))); ax.set_yticklabels(hd.index, fontsize=9)
    for i in range(len(hd)):
        for j in range(len(sc_cols)):
            v=hd.values[i,j]; ax.text(j,i,f'{v:.2f}',ha='center',va='center',fontsize=8,color='white' if v<0.3 or v>0.7 else 'black')
    plt.colorbar(im, label='Score (0-1)', shrink=0.8)
    ax.set_title('Area Performance Scorecard (sorted by Market Balance)', fontweight='bold', pad=15)
    fig.tight_layout(); fig.savefig(cd/'08_area_scorecard_heatmap.png', dpi=150, bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 8: Area Scorecard Heatmap")

    
    if len(cat_metrics)>0:
        fig,(ax1,ax2)=plt.subplots(1,2,figsize=(16,7)); tc=cat_metrics.head(12)
        ax1.barh(tc['cuisine'],tc['count'],color=COLORS['primary'],edgecolor='white',lw=0.5)
        ax1.set_xlabel('Number of Cafes'); ax1.set_title('Cuisine Category Distribution',fontweight='bold')
        ax2.scatter(tc['avg_price'],tc['avg_rating'],s=tc['count']*20,c=tc['avg_sentiment'],cmap='RdYlGn',edgecolors=COLORS['dark'],alpha=0.8)
        for _,r in tc.iterrows(): ax2.annotate(r['cuisine'],(r['avg_price'],r['avg_rating']),fontsize=8,ha='center',va='bottom',xytext=(0,6),textcoords='offset points')
        ax2.set_xlabel('Avg Price'); ax2.set_ylabel('Avg Rating'); ax2.set_title('Cuisine: Price vs Quality',fontweight='bold')
        fig.tight_layout(); fig.savefig(cd/'09_cuisine_analysis.png',dpi=150,bbox_inches='tight'); plt.close(fig)
        log.info("  Chart 9: Cuisine Analysis")

    
    fig, ax = plt.subplots(figsize=(12,8))
    sc10 = ax.scatter(area_metrics['barrier_to_entry'], area_metrics['market_balance'], s=area_metrics['total_cafes']*15,
        c=area_metrics['growth_momentum'], cmap='plasma', alpha=0.8, edgecolors=COLORS['dark'], lw=0.8)
    for _, r in area_metrics.iterrows(): ax.annotate(r['area'],(r['barrier_to_entry'],r['market_balance']),fontsize=8,ha='center',va='bottom',xytext=(0,8),textcoords='offset points',fontweight='bold')
    plt.colorbar(sc10, label='Growth Momentum', shrink=0.8)
    ax.set_xlabel('Barrier to Entry (Rent+Utility)', fontweight='bold'); ax.set_ylabel('Market Balance Score', fontweight='bold')
    ax.set_title('Investment Barrier vs Market Opportunity\n(Size=# cafes, Color=Growth)', fontweight='bold', pad=15)
    ax.axhline(y=area_metrics['market_balance'].median(),color=COLORS['grid'],ls='--',alpha=0.5)
    ax.axvline(x=area_metrics['barrier_to_entry'].median(),color=COLORS['grid'],ls='--',alpha=0.5)
    ax.text(0.22,0.92,'Best Value',transform=ax.transAxes,fontsize=9,ha='center',color=COLORS['success'],fontstyle='italic')
    ax.text(0.78,0.92,'Premium Bet',transform=ax.transAxes,fontsize=9,ha='center',color=COLORS['primary'],fontstyle='italic')
    fig.tight_layout(); fig.savefig(cd/'10_barrier_vs_opportunity.png',dpi=150,bbox_inches='tight'); plt.close(fig)
    log.info("  Chart 10: Barrier vs Opportunity")

    cfiles = list(cd.glob('*.png'))
    log.info(f"\n  Total charts: {len(cfiles)}")
    return cfiles

def export_artifacts(df_biz, area_metrics, cat_metrics, opp_df, output_dir=OUTPUT_DIR):
    log.info("="*70); log.info("STAGE 11: EXPORTING ARTIFACTS"); log.info("="*70)
    exports = {}
    biz_cols = ['Name','Address','area','Rating','Reviews','price_index','Cuisine_Primary','Cuisine_Secondary','Fusion',
        'competitors_within_500m','Footfall_Score','tourist_index','population_density_people_per_sqkm',
        'avg_commercial_rent_aed_sqft_year','utility_cost_aed_month','utility_level','parking_score','has_valet',
        'review_density','price_position_index','rating_zscore','engagement_proxy','location_attractiveness',
        'rent_normalized','is_premium','is_budget','sentiment_mean','sentiment_std','positive_ratio','negative_ratio',
        'review_momentum','growth_class','Latitude','Longitude','Place_ID']
    be = df_biz[[c for c in biz_cols if c in df_biz.columns]].copy()
    fp = output_dir/'cleaned_business_level.csv'; be.to_csv(fp, index=False); exports['cleaned_business_level.csv']=len(be); log.info(f"  {fp} ({len(be)} rows)")
    fp = output_dir/'area_metrics.csv'; area_metrics.to_csv(fp, index=False); exports['area_metrics.csv']=len(area_metrics); log.info(f"  {fp} ({len(area_metrics)} rows)")
    if len(cat_metrics)>0:
        fp = output_dir/'category_metrics.csv'; cat_metrics.to_csv(fp, index=False); exports['category_metrics.csv']=len(cat_metrics); log.info(f"  {fp} ({len(cat_metrics)} rows)")
    fp = output_dir/'opportunity_metrics.csv'; opp_df.to_csv(fp, index=False); exports['opportunity_metrics.csv']=len(opp_df); log.info(f"  {fp} ({len(opp_df)} rows)")
    return exports


API_CODE = '''"""
FastAPI server for Dubai Cafe Market Intelligence.
Run: uvicorn dubai_cafe_api:app --reload --port 8000
"""
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
app = FastAPI(title="Dubai Cafe Market Intelligence API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
try:
    biz_df = pd.read_csv("outputs/cleaned_business_level.csv")
    area_df = pd.read_csv("outputs/area_metrics.csv")
    cat_df = pd.read_csv("outputs/category_metrics.csv")
    opp_df = pd.read_csv("outputs/opportunity_metrics.csv")
except FileNotFoundError as e:
    print(f"Run main pipeline first. {e}"); biz_df=area_df=cat_df=opp_df=pd.DataFrame()

@app.get("/health")
def health(): return {"status":"ok","areas":len(area_df),"businesses":len(biz_df)}

@app.get("/areas")
def list_areas(): return area_df.to_dict(orient="records") if not area_df.empty else []

@app.get("/areas/{area_name}")
def get_area(area_name:str):
    m=area_df[area_df["area"].str.lower()==area_name.lower()]
    if m.empty: raise HTTPException(404,f"Area not found: {area_name}")
    row=m.iloc[0].to_dict()
    row["businesses"]=biz_df[biz_df["area"].str.lower()==area_name.lower()][["Name","Rating","Reviews","price_index","sentiment_mean"]].to_dict(orient="records")
    return row

@app.get("/recommend")
def recommend(profile:str=Query("balanced_investor"), top_n:int=Query(10)):
    m=opp_df[opp_df["profile"]==profile]
    if m.empty: raise HTTPException(404,f"Profile not found: {profile}")
    return m.nlargest(top_n,"opportunity_score").to_dict(orient="records")

@app.get("/categories")
def categories(): return cat_df.to_dict(orient="records") if not cat_df.empty else []

@app.get("/business/{name}")
def business(name:str):
    m=biz_df[biz_df["Name"].str.lower().str.contains(name.lower())]
    if m.empty: raise HTTPException(404,f"Not found: {name}")
    return m.head(5).to_dict(orient="records")
'''

def write_api_file(output_dir=OUTPUT_DIR):
    fp = output_dir/'dubai_cafe_api.py'
    with open(fp,'w') as f: f.write(API_CODE)
    log.info(f"  API file: {fp}")
    return fp


def main():
    print("\n"+"="*70)
    print("  DUBAI CAFE MARKET INTELLIGENCE - ANALYTICS PIPELINE")
    print("  Graduation Project: AI-Powered Cafe Location Advisor")
    print("="*70+"\n")
    t0 = datetime.now()
    sources = load_all_sources()
    schema = detect_schema(sources)
    df_merged = merge_all_sources(sources)
    df_clean = clean_business_data(df_merged)
    df_biz = engineer_business_features(df_clean)
    reviews_df = sources.get('reviews', None)
    df_biz, reviews_sentiment = compute_sentiment_features(df_biz, reviews_df)
    trends = extract_trends(sources)
    df_biz = compute_review_growth(reviews_df, df_biz)
    area_metrics = compute_competition_metrics(df_biz)
    area_metrics = compute_area_performance(area_metrics, df_biz)
    cat_metrics = compute_category_metrics(df_biz)
    opp_df, scorer = build_opportunity_metrics(area_metrics)
    chart_files = generate_charts(area_metrics, df_biz, cat_metrics, opp_df, trends, reviews_sentiment)
    exports = export_artifacts(df_biz, area_metrics, cat_metrics, opp_df)
    write_api_file()
    elapsed = (datetime.now()-t0).total_seconds()

    print("\n"+"="*70)
    print("  PIPELINE COMPLETE")
    print("="*70)
    print(f"\n  Time: {elapsed:.1f}s")
    print(f"\n  Generated Files:")
    for fn, nr in exports.items(): print(f"   - outputs/{fn} ({nr} rows)")
    print(f"   - outputs/charts/ ({len(chart_files)} charts)")
    print(f"   - outputs/dubai_cafe_api.py")

    print("\n"+"="*70)
    print("  TOP 5 AREA OPPORTUNITY PROFILES (Balanced Investor)")
    print("="*70)
    bal = opp_df[opp_df['profile']=='balanced_investor'].head(5)
    for i,(_,r) in enumerate(bal.iterrows(),1):
        print(f"\n  #{i} {r['area']}")
        print(f"      Score: {r['opportunity_score']:.1f}/100 | Market: {r.get('market_positioning','N/A')}")
        print(f"      Demand: {r['demand_score']:.2f} | Competition: {r['competition_intensity']:.2f} | Reputation: {r['reputation_strength']:.2f}")
        print(f"      Growth: {r['growth_momentum']:.2f} | Barrier: {r['barrier_to_entry']:.2f}")
        print(f"      Strengths: {r.get('strengths','N/A')}")
        print(f"      Risks: {r.get('risks','N/A')}")

    print("\n"+"="*70)
    print("  RECOMMENDATION DEMO: recommend_areas()")
    print("="*70)
    for pn in ['budget_cautious','premium_concept']:
        pc = OpportunityScorer.PROFILES[pn]
        print(f"\n  --- Profile: {pc['label']} ---")
        print(f"  Strategy: {pc['description']}")
        res = scorer.recommend_areas(pc)
        for i,(_,r) in enumerate(res.head(5).iterrows(),1):
            print(f"    #{i} {r['area']} - Score: {r['opportunity_score']:.1f}/100")
            print(f"       {r['explanation']}")

    print(f"\n  --- Custom: Specialty Coffee in Artsy Neighborhood ---")
    custom = scorer.recommend_areas({
        'label':'Specialty Coffee Artsy','description':'Artisanal concept in creative, growing neighborhoods.',
        'weights':{'demand_score':0.15,'competition_intensity':-0.25,'price_level_index':0.10,
            'reputation_strength':0.25,'growth_momentum':0.30,'barrier_to_entry':-0.15},
    })
    for i,(_,r) in enumerate(custom.head(5).iterrows(),1):
        print(f"    #{i} {r['area']} - Score: {r['opportunity_score']:.1f}/100")
        print(f"       {r['explanation']}")

    print("\n"+"="*70)
    print("  All outputs in ./outputs/")
    print("  API: cd outputs && uvicorn dubai_cafe_api:app --reload")
    print("="*70+"\n")
    return {'business_data':df_biz,'area_metrics':area_metrics,'category_metrics':cat_metrics,'opportunity_metrics':opp_df,'scorer':scorer,'trends':trends}

if __name__ == '__main__':
    results = main()
