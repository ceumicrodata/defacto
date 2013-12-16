# -*- coding: utf-8 -*-
"""
Created on Mon Aug 19 16:46:04 2013

1. Downloads and extracts tsv files from Eurostat Bulkdownload facility
    - the relative path to target directory is given in module constant:
        OUTPUT_DIR
    - the file with specification for input tables is given in module
      constant:
          TABLE_DIR_FILE

2. Produces primary raw input csvs listed in input table specification file
   from bulk eurostat tsvs:
     - filters the needed records based on given code specifications
     - transposes the tables to have the date values as rows labels
     - unstacks to have different columns for expand_fields (country,
       country group code)
     - normalize data to empty or numeric
       
3. Parses date values. Adds column with time/period/date type. 

@author: balint
"""

# import sys
import unicodecsv
import os
import re
import calendar, datetime


TABLE_DIR_FILE = './metadata/series_metadata.csv'
OUTPUT_DIR = '../data/download/'


class InputTables(object):
    '''

    '''
    def __init__(self,input_spec_file_path):
        self.eurostat_tables =set()
        self.input_table_specs = []
        with open(input_spec_file_path, 'r') as file:
            self.csvreader = unicodecsv.DictReader(file,
                                              encoding='iso-8859-1',
                                              delimiter=';')
            self.specfields = self.csvreader.fieldnames
            self.read_input_table_spec()

    def read_input_table_spec(self):
        for row in self.csvreader:
            table = row[u'path short']
            self.eurostat_tables.add(table)
            self.input_table_specs.append(row)


def download_extract_eurostat(tables, output_dir=OUTPUT_DIR):
    ' 01. Clear output directory:'
    # this can be done with os.path to be os independent
    os.system('rm {}*'.format(output_dir))

    '02. Bulkdownload:'
    def download_url(table_name):
        'The Eurostat bulkdownload schema:'
        return ('''"http://epp.eurostat.ec.europa.eu/NavTree_prod/everybody/\
            BulkDownloadListing?sort=1&file=data%2F{}.tsv.gz"''').format(
            table_name).replace(' ','')
    def wget_command(table_name, output_dir):
        'The wget prompt command for downloading a single eurostat table:'
        output_option = '-O {0}{1}.tsv.gz '.format(output_dir,table_name)
        return 'wget ' + output_option + download_url(table_name)

    for table in tables:
        os.system(wget_command(table, OUTPUT_DIR))

    ' 03. Extract eurostat tsv-s:'
    # similarly, there is zip lib in the standard lib
    os.system("gzip -d {}*.gz".format(OUTPUT_DIR))


def read_eurostat_header(filepath):
    r=unicodecsv.DictReader(open(filepath,'r'), delimiter='\t')
    return r.fieldnames

input_tables = InputTables(TABLE_DIR_FILE)
download_extract_eurostat(input_tables.eurostat_tables)

'''for table in input_tables.eurostat_tables:
    print read_eurostat_header(OUTPUT_DIR+table+'.tsv')
'''
print input_tables.specfields
print

def eurostatindex_to_cecil(string):
    if string[:6] == u'indic_':
        return u'INDIC'
    if string[:5] == u'nace_':
        return u'NACE'
    return string.upper()

class DateParser(object):

    def __init__(self, date_string):
        self.original = date_string
        self.pattern = re.compile(r'([0-9]{4})([MQ]{0,1})([0-9]{0,2})')
        self.matched_date = self.pattern.match(self.original)
        self.date_type = self.get_date_type()
        self.year = self.get_year()
        self.period = self.get_period()
        self.date = self.get_date()
        
    def get_year(self):
        try:
            return int(self.matched_date.groups()[0])
        except:
            return ''

    def get_period(self):
        try:
            if self.date_type == 'Y':
                return 1
            return int(self.matched_date.groups()[2])
        except:
            return ''
            
    def get_date_type(self):
        # match_to_type = dict([('','Yearly'),('M','Monthly'),('Q','Quaterly')])
        match_to_type = dict([('','Y'),('M','M'),('Q','Q')])        
        try:
            match = self.matched_date.groups()[1]
            return match_to_type[match]
        except:
            return ''

    def get_date(self):
            month_multiplier = {'Y':12,'Q':3,'M':1}
            month = self.period * month_multiplier[self.date_type]
            day = calendar.monthrange(self.year,month)[1]
            return datetime.date(self.year,month,day).isoformat()
        
# Input table-wise operations
table_counter = 0
for table_spec in input_tables.input_table_specs:
    table_counter += 1
    table = table_spec[u'path short']

    # Retrieving EUROSTAT index code fields
    index_string = read_eurostat_header(OUTPUT_DIR+table+'.tsv')[0]\
                                                    .replace('\\time','')
    index = index_string.split(',')

    # Compiling index filter and determining expand fields:
    index_filter = []
    count_expand_fields = 0
    expand_fields = []
    expand_fields_name = ''
    for field in index:
        # if field == u'intrt': # Interest rate type not specified by Cecil
        #    index_filter.append(u'MAT_Y10') # <= the only type present
        #    continue                        # in the single Eurostat table
                                            # where the index was used
        field_cecil = eurostatindex_to_cecil(field)
        sub_fields = [i.strip() for i in table_spec[
                                                field_cecil].split(',')]
        if len(sub_fields) > 1:
            count_expand_fields += 1
            expand_fields = sub_fields
            expand_fields_name = field
            continue
        #print table_spec[field_cecil]
        index_filter.append(table_spec[field_cecil].strip(" '"))
    # print index_filter
    if len(expand_fields) == 0:
            expand_fields_name = index[-1]
            expand_fields += index_filter[-1:]
            index_filter = index_filter[:-1]
            if len(index_filter) == 0:
                index_filter =['']
    # print index_filter

    if count_expand_fields < 2:
        print str(table_counter) + '. ' + table_spec[u'alapadat'] #.encode('iso-8859-1')
        print table
        print 'Eurostat index codes: ' + index_string
        print 'Expand fields: ' + str(count_expand_fields) + 'db, used: '\
                    + expand_fields_name + ' - '+ repr(expand_fields )

        print 'Filter: ' + ','.join(index_filter)
        # print read_eurostat_header(OUTPUT_DIR+table+'.tsv')
        print

    def transform_eurostat_table(reader, index_filter, expand_fields):
        output_dict = {}
        index_field_name = reader.fieldnames[0]
        time_field_names = reader.fieldnames[1:]
        for time in time_field_names:
            output_dict.update([(time,{})])
        for row in reader:
            # Filter:
            found_expand_field = ''
            for field in expand_fields:
                if row[index_field_name] == ','.join(index_filter) + ',' + field:
                    found_expand_field = field
                    break
            if found_expand_field == '': continue

            # Fill output_dict with row:
            for time in time_field_names:
                strip_chars = ' :bcdefinprsuz'
                output_dict[time].update([(found_expand_field,row[time].strip(strip_chars))])
        return output_dict

    # if table_counter not in [34]: continue
    with open(OUTPUT_DIR+table+'.tsv','r') as file:
        # print index_filter, expand_fields
        reader = unicodecsv.DictReader(file, delimiter='\t')
        o_dict = transform_eurostat_table(reader, index_filter, expand_fields)

    output_file_name = '{0:02d}_{1}'.format(table_counter,table)
    with open(OUTPUT_DIR+output_file_name+'.csv','wb') as file:
        fields = 'date_type,date'.split(',') + expand_fields
        writer = unicodecsv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        inputdates = o_dict.keys()
        inputdates.sort()
        # print dates
        for indate in inputdates:
            expand_dict = o_dict[indate]
            parsed_date = DateParser(indate)            
            expand_dict.update([('date_type',parsed_date.date_type)])
            expand_dict.update([('date',parsed_date.date)])
            writer.writerow(expand_dict)





