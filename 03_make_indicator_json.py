# -*- coding: utf-8 -*-

import os
import re
import csv
from collections import defaultdict
import json

INDICATOR_SOURCE_FOLDER = '../data/staging/'
indicator_files = os.listdir(INDICATOR_SOURCE_FOLDER)

UPLOAD_FOLDER = '../data/upload/'
if not os.path.isdir(UPLOAD_FOLDER):
    os.mkdir(UPLOAD_FOLDER)


def indicator_from_file(filename):
    indicator_pattern = re.compile(r'\d+-\d+-([a-z]+).csv')
    m = indicator_pattern.match(filename)
    if m:
        return m.group(1)
    else:
        return None

def process_indicator_file(filename):
    # Extracting indicator name from filename if valid:
    indicator = indicator_from_file(filename)
    if indicator:
        indicator_countries = defaultdict(list)
        # Open, read csv, constructing list of dicts type dataseries:
        with open(INDICATOR_SOURCE_FOLDER + filename, 'r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                json_entry = dict()
                json_entry['date'] = row['date'][:10]
                json_entry['values'] = row['values']
                json_entry['country'] = row['country']
                indicator_countries[row['country']].append(json_entry)
        # Create indicator directory if not exists
        indicator_folder = UPLOAD_FOLDER + indicator
        if not os.path.isdir(indicator_folder): os.mkdir(indicator_folder)
        # Write country jsons to indicator folder
        for country, data_series in indicator_countries.iteritems():
            file_path = indicator_folder + '/' + country + '.json'
            json.dump(data_series, open(file_path, 'wb'), separators=(',', ':'))

for filename in indicator_files:
    process_indicator_file(filename)