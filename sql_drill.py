import streamlit as st
import pandas as pd
import numpy as np

st.set_page_config(layout="wide")

# dummy_participant = pd.DataFrame({"No":[1, 2, 3, 4, 5],
#                                   "Member1": ['satu', 'empat', 'enam', 'delapan', 'sepuluh'],
#                                   "Member2": ['dua', 'lima', 'tujuh', 'sembilan', 'sebelas'],
#                                   "Member3": ['tiga', np.nan, np.nan, np.nan, np.nan]})
participant = pd.read_csv("https://docs.google.com/spreadsheets/d/1kLkYToZVi1b2Gb_y4lSRNKJcHAZ0EcJTdc_nH0TR0sM/export?format=csv&gid=1821787422")


score1 = pd.read_csv("https://docs.google.com/spreadsheets/d/1kLkYToZVi1b2Gb_y4lSRNKJcHAZ0EcJTdc_nH0TR0sM/export?format=csv&gid=712816323")
score2 = pd.read_csv("https://docs.google.com/spreadsheets/d/1kLkYToZVi1b2Gb_y4lSRNKJcHAZ0EcJTdc_nH0TR0sM/export?format=csv&gid=890149895")
score3 = pd.read_csv("https://docs.google.com/spreadsheets/d/1kLkYToZVi1b2Gb_y4lSRNKJcHAZ0EcJTdc_nH0TR0sM/export?format=csv&gid=1342700533")

def scoring(df):
    df['score'] = df['Score'].str.split('/').str[0].str.strip().astype(int)
    df['rank'] = df['Timestamp'].rank(ascending=False).astype(int)
    
    min_rank = df['rank'].min()
    max_rank = df['rank'].max()
    scaled_min = 10
    scaled_max = 40
    df['scaled_rank'] = ((df['rank'] - min_rank) / (max_rank - min_rank) * (scaled_max - scaled_min) + scaled_min).astype(int)
    df['score'] = df['score'] + df['scaled_rank']
    return df[['grup', 'score']]

def show_team(df):
    team2 = []
    name2 = []
    for i in range(len(df)):
        if len(df)%2 == 1:
            if i <= int(np.median(range(len(df)))):
                if i != int(np.median(range(len(df)))):
                    team2.append(i+1)
                    name2.append(df['nama'].tolist()[i])
                    team2.append(i+1)
                    name2.append(df['nama'].tolist()[(i+1)*-1])
                else:
                    team2.append(i)
                    name2.append(df['nama'].tolist()[i])
        else:
            if i <= int(np.median(range(len(df)))):
                team2.append(i+1)
                name2.append(df['nama'].tolist()[i])
                team2.append(i+1)
                name2.append(df['nama'].tolist()[(i+1)*-1])
    df_team2 = pd.DataFrame({'grup':team2, 'nama':name2})
    return df_team2

if "participant" not in st.session_state:
    participant = participant.reset_index()
    participant['No'] = participant['index']
    st.session_state.participant = participant[['No', 'Member1', 'Member2', 'Member3']]
if "score1" not in st.session_state:
    st.session_state.score1 = scoring(score1)
if "score2" not in st.session_state:
    st.session_state.score2 = scoring(score2)
if "score3" not in st.session_state:
    st.session_state.score3 = scoring(score3)



def main():
    st.title("SQL Drill")
    refresh_button = st.button("Refresh Page")
    if refresh_button:
        del st.session_state['participant']
        st.rerun()
    tab_start, tab_satu, tab_dua, tab_tiga = st.tabs(['start', '1st Round', '2nd Round', '3rd Round'])
    
    with tab_start:
        col_start1, col_start2 = st.columns([0.8, 0.2])
        with col_start1:
            st.markdown("[Sign Up Here](https://forms.gle/EoKG62ETGdXzpKKs6)", unsafe_allow_html=True)
        with col_start2:
            st.markdown("[Go to 1st Round Drill here](https://forms.gle/JwtQfrYf1KcdEiAh8)", unsafe_allow_html=True)
            
        name = st.session_state.participant[['Member1', 'Member2', 'Member3']]
        team1 = []
        name1 = []
        for idx, i in name.iterrows():
            for j in range(3):
                if pd.notna(i[j]):
                    team1.append(idx+1)
                    name1.append(i[j])

        st.session_state.df_satu = pd.DataFrame({"grup": team1, "nama" : name1})
        st.dataframe(st.session_state.df_satu, hide_index=True, use_container_width=True, height=(len(st.session_state.df_satu) + 1) * 45)
    
    with tab_satu:
        col1_1, col1_2 = st.columns(2)
        if len(st.session_state.score1) > 1:
            df_satu_final = st.session_state.df_satu.merge(st.session_state.score1, left_on='grup', right_on='grup')
            df_satu_final.sort_values(by='score', ascending=False, inplace=True)
            with col1_1:
                st.subheader("Leaderboard")
                with st.container(border=True):
                    st.dataframe(df_satu_final, hide_index=True, use_container_width=True)
            with col1_2:
                col1_2_1, col1_2_2 = st.columns([0.7, 0.3])
                with col1_2_1:
                    st.subheader("Next Group")
                with col1_2_2:
                    st.markdown("[Proceed to Round 2](https://forms.gle/dNJ3t4avqUpx8pzPA)", unsafe_allow_html=True)
                with st.container(border=True):
                    st.session_state.df_dua = show_team(df_satu_final)
                    st.dataframe(st.session_state.df_dua, hide_index=True, use_container_width=True)
        else:
            st.empty()

    with tab_dua:
        col2_1, col2_2 = st.columns(2)
        if len(st.session_state.score2) > 1:
            df_dua_final = st.session_state.df_dua.merge(st.session_state.score2, left_on='grup', right_on='grup')
            df_dua_final.sort_values(by='score', ascending=False, inplace=True)
            with col2_1:
                st.subheader("Leaderboard")
                with st.container(border=True):
                    st.dataframe(df_dua_final, hide_index=True, use_container_width=True)
            with col2_2:
                col2_2_1, col2_2_2 = st.columns([0.7, 0.3])
                with col2_2_1:
                    st.subheader("Next Group")
                with col2_2_2:
                    st.markdown("[Proceed to Round 3](https://forms.gle/T5Tfc86BvJCpi6sh8)", unsafe_allow_html=True)
                with st.container(border=True):
                    st.session_state.df_tiga = show_team(df_dua_final)
                    st.dataframe(st.session_state.df_tiga, hide_index=True, use_container_width=True)
        else:
            st.empty()
    
    with tab_tiga:
        col3_1, col3_2 = st.columns(2)
        if len(st.session_state.score3) > 1:
            df_tiga_final = st.session_state.df_tiga.merge(st.session_state.score3, left_on='grup', right_on='grup')
            df_tiga_final.sort_values(by='score', ascending=False, inplace=True)
            with col3_1:
                st.subheader("Leaderboard")
                with st.container(border=True):
                    st.dataframe(df_tiga_final, hide_index=True, use_container_width=True)
            with col3_2:
                st.subheader("Final Score")
                with st.container(border=True):
                    df_final_final = st.session_state.df_satu.copy()
                    df_final_final = df_final_final.merge(df_satu_final, how='left', left_on='nama', right_on='nama')
                    df_final_final = df_final_final.rename(columns={'score':'score1'})
                    df_final_final = df_final_final[['nama', 'score1']]
                    # st.dataframe(df_final_final)
                    df_final_final = df_final_final.merge(df_dua_final, how='left', left_on='nama', right_on='nama')
                    df_final_final = df_final_final.rename(columns={'score':'score2'})
                    df_final_final = df_final_final[['nama', 'score1', 'score2']]
                    # st.dataframe(df_final_final)
                    df_final_final = df_final_final.merge(df_tiga_final, how='left', left_on='nama', right_on='nama')
                    df_final_final = df_final_final.rename(columns={'score':'score3'})
                    df_final_final = df_final_final[['nama', 'score1', 'score2', 'score3']]
                    # st.dataframe(df_final_final)
                    df_final_final = df_final_final.fillna(0)
                    df_final_final['final score'] = df_final_final['score1'] + df_final_final['score2'] + df_final_final['score3']
                    df_final_final['rank'] = df_final_final['final score'].rank(method='min', ascending=False).astype(int)
                    df_final_final = df_final_final[['rank', 'nama', 'final score']]
                    df_final_final.sort_values(by='final score', ascending=False, inplace=True)
                    st.dataframe(df_final_final, hide_index=True, use_container_width=True)

        else:
            st.empty()





if __name__ == '__main__':
    main()