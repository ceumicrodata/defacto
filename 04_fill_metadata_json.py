# -*- coding: utf-8 -*-



import unicodecsv

import json

from collections import defaultdict, OrderedDict

import sys

import codecs



METADATA_CSV_PATH = './metadata/series_front_metadata.csv'
DATE_METADATA_CSV_PATH = './metadata/date_range_metadata.csv'
# write directly to frontend

METADATA_JSON_TARGET = '../data/metadata.json'

CHART_DEFAULTS = dict(valueFormat=".1f", valueMin=0, valueMax=30)





def generate_queries(indicator, eu_region):

    def generate_url(indicator, geo_code, regions=False):

        if regions:

            geo_status = 'region'

        else:

            geo_status = 'country'

        return u'data/upload/{}/{}.json'.format(indicator, geo_code)

    queries = list()

    if indicator == 'exchangerate':

        queries.append(dict([("url", generate_url(indicator, 'HUF')), ("queryDetails", "referenceCountry")]))

        queries.append(dict([("url", generate_url(indicator, 'CZK')), ("queryDetails", "regions_nc")]))

        queries.append(dict([("url", generate_url(indicator, 'PLN')), ("queryDetails", "regions_nc1")]))

        return queries

    if eu_region != '':

        queries.append(dict([("url", generate_url(indicator, eu_region)), ("queryDetails", "regions_nc")]))

    queries.append(dict([("url", generate_url(indicator, 'V3')), ("queryDetails", "regions")]))

    queries.append(dict([("url", generate_url(indicator, 'HU')), ("queryDetails", "referenceCountry")]))

    queries.append(dict([("url", generate_url(indicator, 'SK')), ("queryDetails", "v4_1")]))

    queries.append(dict([("url", generate_url(indicator, 'CZ')), ("queryDetails", "v4_2")]))

    queries.append(dict([("url", generate_url(indicator, 'PL')), ("queryDetails", "v4_3")]))

    return queries





def generate_chart(indicator, chart_title, description, details, eu_region, dateMin, dateMax):

    chart = dict([("title", chart_title)])

    def wrap_description(text, row_lim=80):

        if len(text) <= row_lim:

            return [text.strip()]

        counter = row_lim

        while True:

            if text[counter] in [' ']:

                break

            counter -= 1

        output = [text[:counter]]

        output.extend(wrap_description(text[counter:].strip(), row_lim=row_lim))

        return output

    chart.update([("description", wrap_description(description))])

    chart.update([("details", details)])

    chart.update([("dateMin", dateMin)])

    chart.update([("dateMax", dateMax)])

    chart.update([("dateFrom", dateMin)])

    chart.update([("dateTo", dateMax)])

    chart.update(CHART_DEFAULTS)

    chart.update([("queries", generate_queries(indicator, eu_region))])

    return chart



metadata = defaultdict(defaultdict)

topic_list = []

indicator_date_ranges = dict()
indicator_lists = defaultdict(list)

with open(DATE_METADATA_CSV_PATH, 'rb') as file:
    reader = unicodecsv.DictReader(file, delimiter=',', encoding='utf-8')
    for row in reader:
        indicator_date_ranges[row['indicator']] = (row['date_min'], row['date_max'])

with open(METADATA_CSV_PATH, 'rb') as file:

    reader = unicodecsv.DictReader(file, delimiter=',', encoding='utf-8')

    i=0

    for row in reader:

        if row['topic'] not in metadata.keys():

            topic_list.append(row['topic'])

            i += 1

            if i > 12: break

            metadata[row['topic']]["title"] = row['topic_name']

            metadata[row['topic']]["charts"] = defaultdict()

        chart = generate_chart(

                    row['indicator'], row['chart'], row['description'],

                    row['details'], row['eu_region'],

                    indicator_date_ranges[row['indicator']][0],

                    indicator_date_ranges[row['indicator']][1])

        metadata[row['topic']]["charts"][row['indicator']] = chart

        indicator_lists[row['topic']].append(row['indicator'])



metadata_ordered = OrderedDict()

for key in topic_list:

    metadata_ordered[key] = metadata[key]

    indicators_ordered = OrderedDict()

    for indicator in indicator_lists[key]:

        indicators_ordered[indicator] = metadata[key]['charts'][indicator]

    metadata_ordered[key]['charts'] = indicators_ordered





with codecs.open(METADATA_JSON_TARGET, 'w', 'utf-8') as file:

    json.dump(metadata_ordered, file, indent=4, encoding='utf-8', ensure_ascii=False)



